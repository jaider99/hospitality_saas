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
