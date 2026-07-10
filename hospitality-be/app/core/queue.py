import logging
from arq import create_pool
from arq.connections import RedisSettings
from app.core.setting import settings

logger = logging.getLogger("queue")

async def enqueue_invoice_processing(invoice_id: int, object_key: str, restaurant_id: int, lang: str = "en"):
    """
    Enqueues a background job using ARQ to process the uploaded invoice.
    """
    try:
        redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
        redis_pool = await create_pool(redis_settings)
        job_id = f"process_invoice_{invoice_id}"
        
        # Delete any existing job and abort keys from Redis to prevent duplicate/aborted job IDs from blocking the run
        await redis_pool.delete(f"arq:job:{job_id}")
        await redis_pool.delete(f"arq:abort:{job_id}")
        
        # Enqueue the job. 'process_invoice_task' must match the task name registered on the worker.
        await redis_pool.enqueue_job("process_invoice_task", invoice_id, object_key, restaurant_id, lang, _job_id=job_id)
        await redis_pool.aclose()
        logger.info(f"Enqueued invoice processing job for invoice ID: {invoice_id} with key {object_key}")
    except Exception as e:
        logger.error(f"Failed to enqueue invoice processing job: {str(e)}")
        raise e
