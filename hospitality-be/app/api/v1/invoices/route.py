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

    # 1. Create a PENDING Invoice record
    invoice = Invoice(
        status="PENDING",
        total_amount=0.0
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # Determine file extension from filename
    ext = "pdf"
    if file.filename:
        _, file_ext = os.path.splitext(file.filename)
        if file_ext:
            ext = file_ext.lstrip(".")

    object_key = f"invoice_{invoice.id}.{ext}"
    invoice.source_file = object_key
    db.add(invoice)
    db.commit()

    # 2. Upload bytes to MinIO
    upload_to_minio(file_bytes, object_key)

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
            "ocr_duration": inv.ocr_duration,
            "llm_duration": inv.llm_duration,
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

@router.put("/{invoice_id}", response_model=Dict[str, Any])
async def update_invoice_api(
    invoice_id: int, 
    update_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    try:
        # Explicitly protect fileUrl from being overridden by user
        if "document" in update_data and "fileUrl" in update_data["document"]:
            del update_data["document"]["fileUrl"]
            
        inv = load_invoice(invoice_id, session=db)
        sa_record_id = invoice_id
        if not inv:
            sqlmodel_inv = db.get(Invoice, invoice_id)
            if sqlmodel_inv:
                if sqlmodel_inv.document_number or sqlmodel_inv.invoice_number:
                    from app.ocr.storage import InvoiceRecord
                    search_num = sqlmodel_inv.document_number or sqlmodel_inv.invoice_number
                    sa_inv = db.query(InvoiceRecord).filter(InvoiceRecord.serialNumber == search_num).first()
                    if sa_inv:
                        inv = load_invoice(sa_inv.id, session=db)
                        sa_record_id = sa_inv.id
                
                # If still not found, auto-heal by creating the InvoiceRecord from the SQLModel record
                if not inv:
                    from app.ocr.storage import InvoiceRecord, SupplierRecord, save_invoice
                    from app.ocr.schema import Invoice as InvoiceDTO, Supplier as SupplierDTO, PaymentInfo, DocumentMeta
                    
                    # Resolve/create SupplierRecord in SQLAlchemy
                    supplier_record = None
                    if sqlmodel_inv.supplier_tax_id:
                        supplier_record = db.query(SupplierRecord).filter_by(vatID=sqlmodel_inv.supplier_tax_id).first()
                    if not supplier_record and sqlmodel_inv.supplier_display_name:
                        supplier_record = db.query(SupplierRecord).filter(SupplierRecord.name.ilike(sqlmodel_inv.supplier_display_name)).first()
                    if not supplier_record and sqlmodel_inv.supplier:
                        supplier_record = SupplierRecord(
                            name=sqlmodel_inv.supplier.name,
                            vatID=sqlmodel_inv.supplier.vat_id,
                            legalName=sqlmodel_inv.supplier.legal_name,
                            address=sqlmodel_inv.supplier.address
                        )
                        db.add(supplier_record)
                        db.flush()
                    
                    dto = InvoiceDTO(
                        id=sqlmodel_inv.id,
                        supplierID=supplier_record.id if supplier_record else None,
                        supplierName=sqlmodel_inv.supplier_display_name or (sqlmodel_inv.supplier.name if sqlmodel_inv.supplier else None),
                        type=sqlmodel_inv.document_type or "invoice",
                        date=sqlmodel_inv.document_date or (sqlmodel_inv.issue_date.isoformat() if sqlmodel_inv.issue_date else None),
                        subtotal=sqlmodel_inv.base_amount or 0.0,
                        tax=sqlmodel_inv.iva_amount or 0.0,
                        total=sqlmodel_inv.total_amount or 0.0,
                        discount=sqlmodel_inv.discount or 0.0,
                        payeAmount=sqlmodel_inv.paye or 0.0,
                        greenPointAmount=sqlmodel_inv.green_point or 0.0,
                        ibeeAmount=sqlmodel_inv.ibee or 0.0,
                        taxableAdditionalCost=sqlmodel_inv.attributable_cost or 0.0,
                        netAdditionalCost=sqlmodel_inv.tax_free_costs or 0.0,
                        serialNumber=sqlmodel_inv.invoice_number or sqlmodel_inv.document_number,
                        supplier=SupplierDTO(
                            id=str(supplier_record.id) if supplier_record else None,
                            name=supplier_record.name if supplier_record else (sqlmodel_inv.supplier_display_name or "Unknown Supplier"),
                            vatID=supplier_record.vatID if supplier_record else sqlmodel_inv.supplier_tax_id,
                            legalName=supplier_record.legalName if supplier_record else None
                        )
                    )
                    
                    sa_record_id = save_invoice(dto, session=db, invoice_id=invoice_id)
                    inv = load_invoice(sa_record_id, session=db)
                    
        if not inv:
            raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
        
        existing_data = inv.to_dict()
        
        def update_dict(d, u):
            for k, v in u.items():
                if isinstance(v, dict):
                    d[k] = update_dict(d.get(k, {}), v)
                elif isinstance(v, list) and k == "items":
                    existing_items = d.get("items", [])
                    for incoming_item in v:
                        matched = False
                        for existing in existing_items:
                            if incoming_item.get("id") and existing.get("id") == incoming_item["id"]:
                                existing.update({k: v for k, v in incoming_item.items() if v is not None})
                                matched = True
                                break
                            elif incoming_item.get("providerCode") and existing.get("providerCode") == incoming_item["providerCode"]:
                                existing.update({k: v for k, v in incoming_item.items() if v is not None})
                                matched = True
                                break
                            elif incoming_item.get("product") and existing.get("product") == incoming_item["product"]:
                                existing.update({k: v for k, v in incoming_item.items() if v is not None})
                                matched = True
                                break
                        if not matched:
                            existing_items.append(incoming_item)
                    d["items"] = existing_items
                elif isinstance(v, list) and k == "taxBrackets":
                    existing_tbs = d.get("taxBrackets", [])
                    for incoming_tb in v:
                        matched = False
                        for existing in existing_tbs:
                            if incoming_tb.get("id") and existing.get("id") == incoming_tb["id"]:
                                existing.update({k2: v2 for k2, v2 in incoming_tb.items() if v2 is not None})
                                matched = True
                                break
                        if not matched:
                            existing_tbs.append(incoming_tb)
                    d["taxBrackets"] = existing_tbs
                else:
                    d[k] = v
            return d
            
        updated_dict = update_dict(existing_data, update_data)
        
        d = updated_dict
        from app.ocr.schema_ocr import Supplier as SupplierDTO, PaymentInfo, DocumentMeta, LineItem, TaxBracket
        new_inv = InvoiceDTO(
            id=d.get("id"),
            supplierID=d.get("supplierID"),
            supplierName=d.get("supplierName"),
            uploaderID=d.get("uploaderID"),
            propertyID=d.get("propertyID"),
            categoryID=d.get("categoryID"),
            created=d.get("created"),
            updated=d.get("updated"),
            type=d.get("type", "invoice"),
            ocrStatus=d.get("ocrStatus", "processed"),
            documentID=d.get("documentID"),
            isRefund=d.get("isRefund", False),
            paidStatus=d.get("paidStatus", "unpaid"),
            dueDate=d.get("dueDate"),
            date=d.get("date"),
            subtotal=d.get("subtotal", 0.0),
            tax=d.get("tax", 0.0),
            total=d.get("total", 0.0),
            discount=d.get("discount", 0.0),
            taxableAdditionalCost=d.get("taxableAdditionalCost", 0.0),
            netAdditionalCost=d.get("netAdditionalCost", 0.0),
            payeAmount=d.get("payeAmount", 0.0),
            greenPointAmount=d.get("greenPointAmount", 0.0),
            ibeeAmount=d.get("ibeeAmount", 0.0),
            serialNumber=d.get("serialNumber"),
            isReconciled=d.get("isReconciled", False),
            documentInboxEmail=d.get("documentInboxEmail"),
            observations=d.get("observations"),
            supplier=SupplierDTO(**{k: v for k, v in d.get("supplier", {}).items() if k in SupplierDTO.__dataclass_fields__}),
            payment=PaymentInfo(**{k: v for k, v in d.get("payment", {}).items() if k in PaymentInfo.__dataclass_fields__}),
            document=DocumentMeta(**{k: v for k, v in d.get("document", {}).items() if k in DocumentMeta.__dataclass_fields__}),
            items=[LineItem(**{k: v for k, v in li.items() if k in LineItem.__dataclass_fields__}) for li in d.get("items", [])],
            taxBrackets=[TaxBracket(**{k: v for k, v in tb.items() if k in TaxBracket.__dataclass_fields__}) for tb in d.get("taxBrackets", [])]
        )
        
        success = update_invoice(sa_record_id, new_inv, session=db)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update invoice in database")
            
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
            "message": "Invoice updated successfully",
            "data": new_inv.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger("invoice_api").error(f"Error updating invoice {invoice_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
