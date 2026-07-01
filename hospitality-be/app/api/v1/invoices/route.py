import os
import asyncio
from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session
from typing import List, Dict, Any, Optional

from app.db.session import get_db
from app.module.auth.model import User
from app.module.auth.service import get_current_user
from app.module.invoices.schema import InvoiceListResponse, InvoiceDetailsResponse, InvoiceUploadResponse, InvoiceStatusResponse
from app.module.invoices.service import get_invoices, get_invoice_details
from app.core.translation import get_lang
from app.module.invoices.model import Invoice
from app.core.queue import enqueue_invoice_processing
from app.core.minio import upload_to_minio
from app.core.setting import settings

# In-memory list of active client queues for Server-Sent Events
active_connections: List[asyncio.Queue] = []

router = APIRouter()

@router.post("/upload", response_model=InvoiceUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang)
):
    """
    Accepts multipart file upload of invoice.
    Uploads file to MinIO bucket, creates a PENDING Invoice record in the DB,
    and enqueues the processing job to the ARQ Redis background queue.
    """
    file_bytes = await file.read()

    # 1. Create a PENDING Invoice record (run sync DB ops in thread pool)
    def create_invoice_record():
        inv = Invoice(
            status="PENDING",
            total_amount=0.0
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        return inv

    invoice = await asyncio.to_thread(create_invoice_record)

    # Determine file extension from filename
    ext = "pdf"
    if file.filename:
        _, file_ext = os.path.splitext(file.filename)
        if file_ext:
            ext = file_ext.lstrip(".")

    object_key = f"invoice_{invoice.id}.{ext}"

    def update_source_file(minio_url: str):
        invoice.source_file = object_key
        invoice.file_url = minio_url
        db.add(invoice)
        db.commit()

    minio_url = f"{settings.MINIO_ENDPOINT_URL}/{settings.MINIO_BUCKET_NAME}/{object_key}"
    await asyncio.to_thread(update_source_file, minio_url)

    # 2. Upload bytes to MinIO — run in thread pool to avoid blocking event loop
    await asyncio.to_thread(upload_to_minio, file_bytes, object_key)

    # 3. Enqueue to ARQ background queue with the object_key
    await enqueue_invoice_processing(
        invoice_id=invoice.id,
        object_key=object_key,
        lang=lang
    )

    # Return 202 response
    return {
        "invoiceId": invoice.id,
        "invoiceNumber": None,
        "supplierName": None,
        "totalAmount": 0.0,
        "linesCount": 0,
        "lines": []
    }


@router.get("", response_model=List[InvoiceListResponse])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all invoices with OCR-extracted fields."""
    invoices = get_invoices(db)

    result = []
    for inv in invoices:
        result.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "document_number": inv.document_number or inv.invoice_number,
            "document_date": inv.document_date,
            "supplier_id": inv.supplier_id,
            "supplier_display_name": inv.supplier_display_name or (inv.supplier.name if inv.supplier else None),
            "issue_date": inv.issue_date,
            "total_amount": inv.total_with_iva or inv.total_amount,
            "status": inv.status,
            "supplier": inv.supplier,
            "lines_count": len(inv.lines),
            "payment_status": inv.payment_status,
            "reconciliation_status": inv.reconciliation_status,
            "needs_review": inv.needs_review,
            "ocr_confidence": inv.ocr_confidence,
            "extraction_method": inv.extraction_method,
            "currency": inv.currency,
            # New fields replicated from OCR_invoice
            "supplier_contact_count": inv.supplier_contact_count,
            "green_point": inv.green_point,
            "ibee": inv.ibee,
            "tax_free_costs": inv.tax_free_costs,
            "source_file": inv.source_file,
            "review_reasons": inv.review_reasons,
        })
    return result

class WebhookPayload(BaseModel):
    invoice_id: int
    status: str


async def broadcast_event(message: str):
    """Broadcasts a message to all active SSE connection queues."""
    for queue in active_connections:
        await queue.put(message)


@router.post("/webhook")
async def receive_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """
    Webhook endpoint called by background worker when invoice processing finishes.
    Triggers client EventSource updates to reload documents in real-time.
    """
    import logging
    from datetime import datetime
    api_logger = logging.getLogger("api")

    invoice = db.get(Invoice, payload.invoice_id)
    if invoice and invoice.created_at:
        duration = (datetime.utcnow() - invoice.created_at).total_seconds()
        api_logger.info(
            f"[OCR TIME LOG] Webhook received for Invoice ID: {payload.invoice_id} | "
            f"Status: {payload.status} | Total time since upload: {duration:.2f}s"
        )
    else:
        api_logger.info(
            f"[OCR TIME LOG] Webhook received for Invoice ID: {payload.invoice_id} | "
            f"Status: {payload.status} | (Invoice or created_at not found)"
        )

    await broadcast_event("reload")
    return {"status": "success", "message": "Webhook received and event broadcasted"}



@router.get("/events")
async def events_endpoint():
    """
    SSE stream endpoint. Frontend connects here to receive push notifications
    when updates to invoices occur via the backend webhook.
    """
    async def event_generator():
        queue = asyncio.Queue()
        active_connections.append(queue)
        try:
            while True:
                # Wait for broadcast event
                message = await queue.get()
                yield f"data: {message}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            active_connections.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/{invoice_id}", response_model=InvoiceDetailsResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full invoice line-items details."""
    return get_invoice_details(db, invoice_id)


@router.get("/{invoice_id}/status", response_model=InvoiceStatusResponse)
def get_invoice_status(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lightweight polling endpoint — returns just the processing status.
    (Note: Client-side EventSource is now preferred over polling this endpoint.)
    """
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    return {
        "id": invoice.id,
        "status": invoice.status,
        "needs_review": invoice.needs_review,
        "invoice_number": invoice.document_number or invoice.invoice_number,
        "supplier_name": invoice.supplier_display_name,
        "total_amount": invoice.total_with_iva or invoice.total_amount,
        "extraction_method": invoice.extraction_method,
        "ocr_confidence": invoice.ocr_confidence,
        "ocr_duration": invoice.ocr_duration,
        "llm_duration": invoice.llm_duration,
    }

from app.ocr.schema_ocr import Invoice as InvoiceDTO
from app.ocr.storage import update_invoice, load_invoice

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice_api(
    invoice_id: int,
    db: Session = Depends(get_db)
):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    
    db.delete(inv)
    db.commit()
    return None

@router.delete("/{invoice_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice_line_api(
    invoice_id: int,
    line_id: int,
    db: Session = Depends(get_db)
):
    from app.module.invoices.model import InvoiceLine
    line_record = db.get(InvoiceLine, line_id)
    if not line_record or line_record.invoice_id != invoice_id:
        raise HTTPException(status_code=404, detail="Line not found")
    
    db.delete(line_record)
    db.commit()
    return None

class BulkDeletePayload(BaseModel):
    invoice_ids: List[int]

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_invoices_api(
    payload: BulkDeletePayload,
    db: Session = Depends(get_db)
):
    for inv_id in payload.invoice_ids:
        inv = db.get(Invoice, inv_id)
        if inv:
            db.delete(inv)
    db.commit()
    return None

@router.put("/{invoice_id}", response_model=Dict[str, Any])
async def update_invoice_api(
    invoice_id: int, 
    update_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
        
        # General Document Info
        if "documentNumber" in update_data:
            inv.document_number = update_data["documentNumber"]
        if "invoiceNumber" in update_data:
            inv.invoice_number = update_data["invoiceNumber"]
        if "needs_review" in update_data:
            inv.needs_review = update_data["needs_review"]
        if "status" in update_data:
            inv.status = update_data["status"]
        if "date" in update_data:
            try:
                from datetime import datetime
                d_str = update_data["date"]
                if d_str:
                    inv.issue_date = datetime.fromisoformat(d_str.replace("Z", "+00:00")).replace(tzinfo=None)
                inv.document_date = d_str
            except Exception:
                inv.document_date = update_data["date"]
        
        # Totals
        if "baseAmount" in update_data:
            inv.base_amount = update_data["baseAmount"]
        if "ivaAmount" in update_data:
            inv.iva_amount = update_data["ivaAmount"]
        if "discount" in update_data:
            inv.discount = update_data["discount"]
        if "totalAmount" in update_data:
            inv.total_amount = update_data["totalAmount"]
            inv.total_with_iva = update_data["totalAmount"]
        if "taxFreeCosts" in update_data:
            inv.tax_free_costs = update_data["taxFreeCosts"]

        # Supplier Info
        if "supplierName" in update_data:
            inv.supplier_display_name = update_data["supplierName"]
            
        if "supplier" in update_data and isinstance(update_data["supplier"], dict):
            s_data = update_data["supplier"]
            
            if inv.supplier_id:
                from app.module.invoices.model import Supplier
                supplier = db.get(Supplier, inv.supplier_id)
                if supplier:
                    if "name" in s_data:
                        supplier.name = s_data["name"]
                    if "legal_name" in s_data:
                        supplier.legal_name = s_data["legal_name"]
                        inv.supplier_legal_name = s_data["legal_name"]
                    if "vat_id" in s_data:
                        supplier.vat_id = s_data["vat_id"]
                        inv.supplier_tax_id = s_data["vat_id"]
                    db.add(supplier)
            else:
                if "legal_name" in s_data:
                    inv.supplier_legal_name = s_data["legal_name"]
                if "vat_id" in s_data:
                    inv.supplier_tax_id = s_data["vat_id"]

        # Lines Info
        if "lines" in update_data and isinstance(update_data["lines"], list):
            for l_data in update_data["lines"]:
                line_id = l_data.get("id")
                if line_id:
                    from app.module.invoices.model import InvoiceLine
                    line_record = db.get(InvoiceLine, line_id)
                    if line_record and line_record.invoice_id == invoice_id:
                        if "description" in l_data:
                            line_record.description = l_data["description"]
                        if "product" in l_data:
                            line_record.product = l_data["product"]
                            line_record.description = l_data["product"]
                        if "provider_code" in l_data:
                            line_record.provider_code = l_data["provider_code"]
                        if "quantity" in l_data:
                            line_record.quantity = float(l_data["quantity"] or 0.0)
                        if "unit_price" in l_data:
                            line_record.unit_price = float(l_data["unit_price"] or 0.0)
                        if "total_price" in l_data:
                            line_record.total_price = float(l_data["total_price"] or 0.0)
                        if "nominal_price" in l_data:
                            val = float(l_data["nominal_price"] or 0.0)
                            line_record.nominal_price = val
                            line_record.unit_price = val
                        if "base" in l_data:
                            val = float(l_data["base"] or 0.0)
                            line_record.base = val
                            line_record.total_price = val
                        if "unit" in l_data:
                            line_record.unit = l_data["unit"]
                        if "gross_price" in l_data:
                            line_record.gross_price = float(l_data["gross_price"] or 0.0) if l_data["gross_price"] is not None else None
                        if "discount_pct" in l_data:
                            line_record.discount_pct = float(l_data["discount_pct"] or 0.0) if l_data["discount_pct"] is not None else None
                        if "applied_discount" in l_data:
                            line_record.applied_discount = float(l_data["applied_discount"] or 0.0) if l_data["applied_discount"] is not None else None
                        if "other_fees" in l_data:
                            line_record.other_fees = float(l_data["other_fees"] or 0.0) if l_data["other_fees"] is not None else None
                        if "iva_pct" in l_data:
                            line_record.iva_pct = float(l_data["iva_pct"] or 0.0) if l_data["iva_pct"] is not None else None
                        db.add(line_record)

        # Tax Brackets Info
        if "tax_brackets" in update_data and isinstance(update_data["tax_brackets"], list):
            for t_data in update_data["tax_brackets"]:
                bracket_id = t_data.get("id")
                if bracket_id:
                    from app.module.invoices.model import InvoiceTaxBracket
                    bracket_record = db.get(InvoiceTaxBracket, bracket_id)
                    if bracket_record and bracket_record.invoice_id == invoice_id:
                        if "base" in t_data:
                            bracket_record.base = float(t_data["base"] or 0.0) if t_data["base"] is not None else 0.0
                        if "iva_amount" in t_data:
                            bracket_record.iva_amount = float(t_data["iva_amount"] or 0.0) if t_data["iva_amount"] is not None else 0.0
                        if "rate_pct" in t_data:
                            bracket_record.rate_pct = float(t_data["rate_pct"] or 0.0) if t_data["rate_pct"] is not None else 0.0
                        if "equivalence_surcharge_rate" in t_data:
                            bracket_record.equivalence_surcharge_rate = float(t_data["equivalence_surcharge_rate"] or 0.0) if t_data["equivalence_surcharge_rate"] is not None else None
                        if "equivalence_surcharge" in t_data:
                            bracket_record.equivalence_surcharge = float(t_data["equivalence_surcharge"] or 0.0) if t_data["equivalence_surcharge"] is not None else None
                        if "row_total" in t_data:
                            bracket_record.row_total = float(t_data["row_total"] or 0.0) if t_data["row_total"] is not None else 0.0
                        db.add(bracket_record)

        db.add(inv)
        db.commit()
            
        # Synchronize with SQLModel tables
        from app.module.invoices.model import InvoiceLine, InvoiceTaxBracket, Supplier
        from datetime import datetime
        from sqlmodel import select
        sqlmodel_inv = db.get(Invoice, invoice_id)
        if sqlmodel_inv:
            sqlmodel_inv.invoice_number = new_inv.serialNumber
            sqlmodel_inv.document_number = new_inv.serialNumber
            sqlmodel_inv.document_type = new_inv.type
            if new_inv.date:
                try: sqlmodel_inv.issue_date = datetime.fromisoformat(new_inv.date)
                except: pass
            sqlmodel_inv.total_amount = new_inv.total or 0.0
            sqlmodel_inv.base_amount = new_inv.subtotal
            sqlmodel_inv.iva_amount = new_inv.tax
            sqlmodel_inv.discount = new_inv.discount
            sqlmodel_inv.paye = new_inv.payeAmount
            sqlmodel_inv.green_point = new_inv.greenPointAmount
            sqlmodel_inv.ibee = new_inv.ibeeAmount
            sqlmodel_inv.attributable_cost = new_inv.taxableAdditionalCost
            sqlmodel_inv.tax_free_costs = new_inv.netAdditionalCost
            sqlmodel_inv.total_with_iva = new_inv.total
            sqlmodel_inv.supplier_display_name = new_inv.supplier.name
            sqlmodel_inv.supplier_tax_id = new_inv.supplier.vatID
            
            # Resolve/Update Supplier table in SQLModel
            supplier_name = new_inv.supplier.name or "Unknown Supplier"
            supplier_tax_id = new_inv.supplier.vatID

            sqlmodel_supplier = None
            if supplier_tax_id:
                stmt = select(Supplier).where(Supplier.vat_id == supplier_tax_id)
                sqlmodel_supplier = db.exec(stmt).first()
            if not sqlmodel_supplier and supplier_name and supplier_name != "Unknown Supplier":
                stmt = select(Supplier).where(Supplier.name.ilike(supplier_name))
                sqlmodel_supplier = db.exec(stmt).first()

            if not sqlmodel_supplier:
                sqlmodel_supplier = Supplier(
                    name=supplier_name,
                    vat_id=supplier_tax_id,
                    legal_name=new_inv.supplier.legalName,
                    address=new_inv.supplier.address
                )
                db.add(sqlmodel_supplier)
                db.flush()
            else:
                if supplier_name and supplier_name != "Unknown Supplier":
                    sqlmodel_supplier.name = supplier_name
                if supplier_tax_id:
                    sqlmodel_supplier.vat_id = supplier_tax_id
                if new_inv.supplier.legalName:
                    sqlmodel_supplier.legal_name = new_inv.supplier.legalName
                if new_inv.supplier.address:
                    sqlmodel_supplier.address = new_inv.supplier.address
                db.add(sqlmodel_supplier)
                db.flush()

            sqlmodel_inv.supplier_id = sqlmodel_supplier.id
            
            from sqlalchemy import delete
            db.execute(delete(InvoiceLine).where(InvoiceLine.invoice_id == invoice_id))
            db.execute(delete(InvoiceTaxBracket).where(InvoiceTaxBracket.invoice_id == invoice_id))
            
            db.add_all([
                InvoiceLine(
                    invoice_id=invoice_id,
                    description=li.product or "Unknown Item",
                    quantity=li.quantity or 0.0,
                    unit_price=li.nominalPrice or li.grossPrice or 0.0,
                    total_price=li.totalPrice or 0.0,
                    provider_code=li.providerCode,
                    unit=li.unit,
                    gross_price=li.grossPrice,
                    discount_pct=li.discountPct,
                    applied_discount=li.appliedDiscount,
                    other_fees=li.otherFees,
                    nominal_price=li.nominalPrice,
                    iva_pct=li.iva_pct or 0.0,
                    base=li.base or 0.0
                )
                for li in new_inv.items
            ])
            
            db.add_all([
                InvoiceTaxBracket(
                    invoice_id=invoice_id,
                    rate_pct=tb.taxRate,
                    base=tb.subtotal,
                    iva_amount=tb.tax,
                    row_total=tb.total,
                    equivalence_surcharge_rate=tb.equivalenceSurchargeRate,
                    equivalence_surcharge=tb.equivalenceSurcharge
                )
                for tb in new_inv.taxBrackets
            ])
            db.add(sqlmodel_inv)
            db.commit()
            
        return {
            "status": "success",
            "message": "Invoice updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        import logging, traceback
        logging.getLogger("invoice_api").error(f"Error updating invoice {invoice_id}: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
