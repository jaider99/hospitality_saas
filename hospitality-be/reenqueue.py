import asyncio
from app.core.setting import settings
from arq.connections import RedisSettings, create_pool

async def main():
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    redis = await create_pool(redis_settings)
    
    # Enqueue failed invoices
    for inv_id in [42, 44, 45]:
        await redis.enqueue_job("process_invoice_task", inv_id, f"invoice_{inv_id}.pdf", "en")
        print(f"Enqueued invoice {inv_id}")
    
    await redis.aclose()

if __name__ == "__main__":
    asyncio.run(main())
