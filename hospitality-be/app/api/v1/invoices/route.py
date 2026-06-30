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
            "attributable_cost": inv.attributable_cost,
            "tax_free_costs": inv.tax_free_costs,
            "source_file": inv.source_file,
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
async def receive_webhook(payload: WebhookPayload):
    """
    Webhook endpoint called by background worker when invoice processing finishes.
    Triggers client EventSource updates to reload documents in real-time.
    """
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
        
        success = update_invoice(invoice_id, new_inv, session=db)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update invoice in database")
            
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
