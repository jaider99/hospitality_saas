import os
import logging
import asyncio
from arq.connections import RedisSettings
from app.core.setting import settings
from app.db.session import async_session_maker
from app.module.invoices.async_service import async_save_ocr_invoice
from app.module.invoices.model import Invoice
from app.core.minio import download_from_minio

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

async def startup(ctx):
    """Worker startup hook."""
    logger.info("Starting background worker...")

async def shutdown(ctx):
    """Worker shutdown hook."""
    logger.info("Shutting down background worker...")

async def process_invoice_task(ctx, invoice_id: int, object_key: str, lang: str = "en"):
    """
    ARQ background task: downloads the invoice from MinIO to a temporary local file,
    runs the full OCR pipeline, persists the extracted data, and marks the invoice as PROCESSED.
    Finally, it cleans up the local temp file, leaving the MinIO object stored.

    Pipeline: PaddleOCR/pdfplumber → regex → LLM fallback → validate → save to DB
    """
    logger.info(f"Task process_invoice_task started for Invoice ID: {invoice_id}, Object Key: {object_key}")

    # Retrieve created_at to compute duration and ensure invoice exists
    created_at = None
    async with async_session_maker() as db:
        invoice = await db.get(Invoice, invoice_id)
        if not invoice:
            logger.warning(f"Aborting task: Invoice ID {invoice_id} not found in database. It may have been deleted or the database reset.")
            return
        created_at = invoice.created_at

    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        local_path = tmp_file.name

    try:
        # Download file from MinIO
        logger.info(f"Downloading {object_key} from MinIO to {local_path}...")
        download_from_minio(object_key, local_path)

        # Import here to avoid loading heavy PaddleOCR at startup
        from app.ocr.pipeline import process_invoice

        logger.info(f"Running OCR pipeline on local file: {local_path}")

        # Run in threadpool — PaddleOCR is CPU-bound and blocks the event loop
        base_name = os.path.splitext(object_key)[0]
        ocr_invoice = await asyncio.to_thread(process_invoice, local_path, False, base_name)

        logger.info(
            f"OCR pipeline complete for invoice {invoice_id}: "
            f"doc_number={ocr_invoice.serialNumber}, "
            f"supplier={ocr_invoice.supplier.name if ocr_invoice.supplier else 'Unknown'}, "
            f"total={ocr_invoice.total}"
        )

        # Persist results to the database
        async with async_session_maker() as db:
            result = await async_save_ocr_invoice(
                db=db,
                invoice_id=invoice_id,
                ocr_invoice=ocr_invoice,
                lang=lang,
            )
            logger.info(
                f"Successfully saved invoice {invoice_id}: "
                f"{result.get('invoiceNumber')} | "
                f"{result.get('linesCount')} line items | "
                f"needs_review={result.get('needsReview')}"
            )

        # Trigger Success Webhook
        try:
            import urllib.request
            import json
            backend_url = os.environ.get("BACKEND_URL", f"http://localhost:{settings.PORT}")
            webhook_url = f"{backend_url}/api/v1/invoices/webhook"
            logger.info(f"Triggering success webhook at {webhook_url}...")
            
            data = json.dumps({"invoice_id": invoice_id, "status": "PROCESSED"}).encode("utf-8")
            req = urllib.request.Request(
                webhook_url, 
                data=data, 
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    logger.info(f"Webhook response: {response.status}")
            except Exception as e:
                logger.warning(f"Failed to trigger webhook on success: {e}. (This does not affect invoice processing)")
        except Exception as webhook_err:
            logger.error(f"Failed to trigger webhook on success: {webhook_err}", exc_info=True)

    except Exception as e:
        logger.error(f"Error processing invoice ID {invoice_id}: {str(e)}", exc_info=True)
        # Mark invoice as FAILED with error reason stored
        async with async_session_maker() as db:
            invoice = await db.get(Invoice, invoice_id)
            if invoice:
                invoice.status = "FAILED"
                import json
                invoice.review_reasons = json.dumps([f"Processing error: {type(e).__name__}: {str(e)[:200]}"])
                db.add(invoice)
                await db.commit()

        # Trigger Failure Webhook
        try:
            import httpx
            backend_url = os.environ.get("BACKEND_URL", f"http://localhost:{settings.PORT}")
            webhook_url = f"{backend_url}/api/v1/invoices/webhook"
            logger.info(f"Triggering failure webhook at {webhook_url}...")
            async with httpx.AsyncClient() as client:
                await client.post(webhook_url, json={"invoice_id": invoice_id, "status": "FAILED"})
        except Exception as webhook_err:
            logger.error(f"Failed to trigger webhook on failure: {webhook_err}")
    finally:
        # Clean up temporary local file
        try:
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Cleaned up temporary local file: {local_path}")
        except Exception as cleanup_err:
            logger.warning(f"Failed to delete temp local file {local_path}: {cleanup_err}")


class WorkerSettings:
    """Settings class configured for arq worker execution.
    
    max_jobs=1: PaddleOCR is CPU-bound and uses ~100% of CPU + ~2GB RAM per job.
    Running two jobs in parallel freezes the machine. Serial processing ensures
    each invoice completes in ~15-30s without starving other tasks.
    """
    functions = [process_invoice_task]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 1  # Process one invoice at a time — prevents PaddleOCR from double-loading and freezing
    job_timeout = 900  # 15 minutes (default is 300s) - prevents TimeoutError when downloading heavy models
