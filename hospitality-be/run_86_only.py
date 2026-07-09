import asyncio
from arq import create_pool
from arq.connections import RedisSettings

async def main():
    redis = await create_pool(RedisSettings(port=6378))
    # Flush existing queue
    await redis.delete('arq:queue')
    # Enqueue only 86
    await redis.enqueue_job("process_invoice_task", 86, "invoice_86.pdf", 5, "en")
    print("Flushed queue and enqueued ONLY invoice 86")

if __name__ == "__main__":
    asyncio.run(main())
