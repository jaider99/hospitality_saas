import os
import asyncio
from fastapi import APIRouter, Depends, UploadFile, File, status, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlmodel import Session, select
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
            restaurant_id=current_user.restaurant_id,
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
        restaurant_id=current_user.restaurant_id,
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
    invoices = get_invoices(db, current_user.restaurant_id)

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
            "file_url": inv.file_url,
            "review_reasons": inv.review_reasons,
            "is_duplicate": inv.is_duplicate,
        })
    return result


class WebhookPayload(BaseModel):
    invoice_id: int
    status: str


class WebSocketConnectionManager:
    def __init__(self):
        # Maps restaurant_id (int) to a list of WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, restaurant_id: int):
        await websocket.accept()
        if restaurant_id not in self.active_connections:
            self.active_connections[restaurant_id] = []
        self.active_connections[restaurant_id].append(websocket)

    def disconnect(self, websocket: WebSocket, restaurant_id: int):
        if restaurant_id in self.active_connections:
            if websocket in self.active_connections[restaurant_id]:
                self.active_connections[restaurant_id].remove(websocket)
            if not self.active_connections[restaurant_id]:
                del self.active_connections[restaurant_id]

    async def broadcast_to_restaurant(self, restaurant_id: int, message: str):
        if restaurant_id in self.active_connections:
            for connection in list(self.active_connections[restaurant_id]):
                try:
                    await connection.send_text(message)
                except Exception:
                    self.disconnect(connection, restaurant_id)


ws_manager = WebSocketConnectionManager()


@router.post("/webhook")
async def receive_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """
    Webhook endpoint called by background worker when invoice processing finishes.
    Triggers client WebSocket updates to reload documents in real-time.
    """
    import logging
    from datetime import datetime
    api_logger = logging.getLogger("api")

    invoice = db.get(Invoice, payload.invoice_id)
    restaurant_id = None
    if invoice:
        restaurant_id = invoice.restaurant_id
        if invoice.created_at:
            duration = (datetime.utcnow() - invoice.created_at).total_seconds()
            api_logger.info(
                f"[OCR TIME LOG] Webhook received for Invoice ID: {payload.invoice_id} | "
                f"Status: {payload.status} | Total time since upload: {duration:.2f}s"
            )
        else:
            api_logger.info(
                f"[OCR TIME LOG] Webhook received for Invoice ID: {payload.invoice_id} | "
                f"Status: {payload.status} | (created_at not found)"
            )
    else:
        api_logger.info(
            f"[OCR TIME LOG] Webhook received for Invoice ID: {payload.invoice_id} | "
            f"Status: {payload.status} | (Invoice not found)"
        )

    if restaurant_id is not None:
        api_logger.info(f"Broadcasting reload event to restaurant: {restaurant_id}")
        await ws_manager.broadcast_to_restaurant(restaurant_id, "reload")
    else:
        api_logger.warning("Could not broadcast reload event: restaurant_id not found on invoice")

    return {"status": "success", "message": "Webhook received and event broadcasted"}


@router.websocket("/ws/{restaurant_id}")
async def websocket_endpoint(websocket: WebSocket, restaurant_id: int):
    """
    WebSocket endpoint for real-time document reload notifications.
    Clients connect here scoped by restaurant_id.
    """
    await ws_manager.connect(websocket, restaurant_id)
    try:
        while True:
            # Keep connection alive by waiting for client pings or text
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, restaurant_id)
    except Exception:
        ws_manager.disconnect(websocket, restaurant_id)

@router.post("/{invoice_id}/retry")
async def retry_invoice_processing(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retries OCR processing for a failed invoice.
    """
    statement = select(Invoice).where(Invoice.id == invoice_id, Invoice.restaurant_id == current_user.restaurant_id)
    invoice = db.exec(statement).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.status != "FAILED":
        raise HTTPException(status_code=400, detail="Only failed invoices can be retried")
        
    if not invoice.source_file:
        raise HTTPException(status_code=400, detail="Invoice is missing source_file for source file")
        
    # Reset status
    invoice.status = "PENDING"
    invoice.needs_review = False
    invoice.review_reasons = "[]"
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    await enqueue_invoice_processing(
        invoice_id=invoice.id,
        object_key=invoice.source_file,
        restaurant_id=current_user.restaurant_id,
        lang="en"
    )
    await ws_manager.broadcast_to_restaurant(current_user.restaurant_id, "reload")
    
    return {"status": "success", "message": "Invoice processing retried"}


@router.get("/{invoice_id}", response_model=InvoiceDetailsResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full invoice line-items details."""
    return get_invoice_details(db, invoice_id, current_user.restaurant_id)


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
    statement = select(Invoice).where(Invoice.id == invoice_id, Invoice.restaurant_id == current_user.restaurant_id)
    invoice = db.exec(statement).first()
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
        "llm_confidence": invoice.llm_confidence,
        "ocr_duration": invoice.ocr_duration,
        "llm_duration": invoice.llm_duration,
    }

from app.ocr.schema_ocr import Invoice as InvoiceDTO
from app.ocr.storage import update_invoice, load_invoice

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice_api(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    statement = select(Invoice).where(Invoice.id == invoice_id, Invoice.restaurant_id == current_user.restaurant_id)
    inv = db.exec(statement).first()
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    
    import json
    # Clear duplicate tag from any invoice that was marked as a duplicate of this one
    duplicates = db.query(Invoice).filter(Invoice.is_duplicate == True).all()
    target_str = f"duplicate_invoice: matches #{invoice_id}"
    for dup in duplicates:
        if dup.review_reasons and target_str in dup.review_reasons:
            try:
                reasons = json.loads(dup.review_reasons)
                if isinstance(reasons, list):
                    reasons = [r for r in reasons if r != target_str]
                    dup.review_reasons = json.dumps(reasons) if reasons else None
                    if not reasons:
                        dup.needs_review = False
            except Exception:
                pass
            dup.is_duplicate = False
            db.add(dup)
            
    # Delete from MinIO if source_file exists
    if inv.source_file:
        try:
            from app.core.minio import delete_from_minio
            delete_from_minio(inv.source_file)
        except Exception as e:
            import logging
            logger = logging.getLogger("fastapi_app")
            logger.error(f"Failed to delete invoice {invoice_id} from MinIO: {e}")
            
    # Cancel the background processing job if it is still running or pending
    try:
        from arq import create_pool
        from arq.connections import RedisSettings
        from arq.jobs import Job
        from app.core.setting import settings
        redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
        redis_pool = await create_pool(redis_settings)
        job = Job(f"process_invoice_{invoice_id}", redis_pool)
        await job.abort()
        await redis_pool.aclose()
    except Exception as e:
        import logging
        logger = logging.getLogger("fastapi_app")
        logger.warning(f"Failed to abort ARQ job for invoice {invoice_id}: {e}")

    from datetime import datetime
    now = datetime.utcnow()
    inv.deleted_at = now
    
    for line in inv.lines:
        _soft_delete_invoice_line(db, line, current_user.restaurant_id, now)
        
    for tb in inv.tax_brackets:
        tb.deleted_at = now
        db.add(tb)

    db.add(inv)
    db.commit()
    return None

@router.delete("/{invoice_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice_line_api(
    invoice_id: int,
    line_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.module.invoices.model import InvoiceLine
    statement = select(Invoice).where(Invoice.id == invoice_id, Invoice.restaurant_id == current_user.restaurant_id)
    inv = db.exec(statement).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    line_record = db.get(InvoiceLine, line_id)
    if not line_record or line_record.invoice_id != invoice_id:
        raise HTTPException(status_code=404, detail="Line not found")
    
    from datetime import datetime
    now = datetime.utcnow()
    _soft_delete_invoice_line(db, line_record, current_user.restaurant_id, now)
    
    # Recalculate invoice totals based on remaining lines
    remaining_lines = [l for l in inv.lines if not l.deleted_at]
    inv.total_amount = sum(l.total_price or 0.0 for l in remaining_lines)
    inv.base_amount = sum(l.base or 0.0 for l in remaining_lines)
    inv.iva_amount = sum(l.iva_pct or 0.0 for l in remaining_lines)
    
    db.add(inv)
    db.commit()
    
    return None

def _soft_delete_invoice_line(db, line, restaurant_id, now):
    from sqlmodel import select
    from sqlalchemy import func
    from app.module.products.model import Product, ProductAlias
    from app.module.invoices.model import InvoiceLine, Invoice

    line.deleted_at = now
    db.add(line)
    
    if not line.description:
        return
        
    # Find original product that this line mapped to
    prod = db.exec(
        select(Product).where(Product.name == line.description, Product.restaurant_id == restaurant_id)
    ).first()
    
    if prod:
        master_prod = None
        if prod.merged_into_id:
            master_prod = db.get(Product, prod.merged_into_id)
        else:
            master_prod = prod
            
        # Subtract totals from master_prod
        if master_prod:
            master_prod.quantity = max(0, (master_prod.quantity or 0) - (line.quantity or 0))
            master_prod.total = max(0.0, (master_prod.total or 0.0) - (line.total_price or 0.0))
            db.add(master_prod)

        # Check if prod has any other active invoice lines
        valid_names = {prod.name.lower()}
        aliases = db.exec(select(ProductAlias).where(ProductAlias.master_product_id == prod.id)).all()
        valid_names.update({a.alias_name.lower() for a in aliases})

        other_lines = db.exec(
            select(InvoiceLine)
            .join(Invoice, InvoiceLine.invoice_id == Invoice.id)
            .where(
                func.lower(InvoiceLine.description).in_(valid_names),
                InvoiceLine.deleted_at.is_(None),
                Invoice.deleted_at.is_(None)
            )
            .limit(1)
        ).first()

        if not other_lines:
            # Soft delete product
            prod.deleted_at = now
            db.add(prod)
            
            # Remove its alias from master product if merged
            if prod.merged_into_id:
                alias = db.exec(
                    select(ProductAlias).where(
                        ProductAlias.alias_name == prod.name.lower(),
                        ProductAlias.master_product_id == prod.merged_into_id
                    )
                ).first()
                if alias:
                    db.delete(alias)

class BulkDeletePayload(BaseModel):
    invoice_ids: List[int]

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_invoices_api(
    payload: BulkDeletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import json
    for inv_id in payload.invoice_ids:
        statement = select(Invoice).where(Invoice.id == inv_id, Invoice.restaurant_id == current_user.restaurant_id)
        inv = db.exec(statement).first()
        if inv:
            # Clear duplicate tag from any invoice that was marked as a duplicate of this one
            duplicates = db.query(Invoice).filter(Invoice.is_duplicate == True).all()
            target_str = f"duplicate_invoice: matches #{inv_id}"
            for dup in duplicates:
                if dup.review_reasons and target_str in dup.review_reasons:
                    try:
                        reasons = json.loads(dup.review_reasons)
                        if isinstance(reasons, list):
                            reasons = [r for r in reasons if r != target_str]
                            dup.review_reasons = json.dumps(reasons) if reasons else None
                            if not reasons:
                                dup.needs_review = False
                    except Exception:
                        pass
                    dup.is_duplicate = False
                    db.add(dup)
            
            # Delete from MinIO if source_file exists
            if inv.source_file:
                try:
                    from app.core.minio import delete_from_minio
                    delete_from_minio(inv.source_file)
                except Exception as e:
                    import logging
                    logger = logging.getLogger("fastapi_app")
                    logger.error(f"Failed to delete invoice {inv_id} from MinIO: {e}")
                    
            db.delete(inv)
    db.commit()
    return None

@router.put("/{invoice_id}", response_model=Dict[str, Any])
async def update_invoice_api(
    invoice_id: int, 
    update_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        statement = select(Invoice).where(Invoice.id == invoice_id, Invoice.restaurant_id == current_user.restaurant_id)
        inv = db.exec(statement).first()
        if not inv:
            raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
        
        # General Document Info
        if "documentNumber" in update_data:
            inv.document_number = update_data["documentNumber"]
        if "invoiceNumber" in update_data:
            inv.invoice_number = update_data["invoiceNumber"]
        if "needs_review" in update_data:
            was_review_required = inv.needs_review
            is_review_required = update_data["needs_review"]
            inv.needs_review = is_review_required
            
            # If the invoice just transitioned from "review required" to "digitized"
            if was_review_required and not is_review_required:
                try:
                    from app.module.products.service import digitize_invoice_products
                    digitize_invoice_products(db, inv.id)
                except Exception as e:
                    import logging
                    logger = logging.getLogger("fastapi_app")
                    logger.error(f"Failed to digitize products for invoice {inv.id}: {e}")
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
            if "name" in s_data:
                inv.supplier_display_name = s_data["name"]
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
                        if "product_name" in l_data and isinstance(l_data["product_name"], str):
                            line_record.product = l_data["product_name"]
                        elif "product" in l_data and isinstance(l_data["product"], str):
                            line_record.product = l_data["product"]
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
