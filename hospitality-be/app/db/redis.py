import redis
import logging
from typing import Optional
from app.core.setting import settings

logger = logging.getLogger("redis_cache")

# Initialize Redis Client
try:
    redis_client = redis.Redis.from_url(
        settings.REDIS_URL, 
        decode_responses=True,
        socket_timeout=2.0
    )
except Exception as e:
    logger.error(f"Failed to create Redis client connection: {str(e)}")
    redis_client = None

def get_cache(key: str) -> Optional[str]:
    """Retrieves value from Redis cache."""
    if not redis_client:
        return None
    try:
        return redis_client.get(key)
    except Exception as e:
        logger.warning(f"Failed to get cache key '{key}': {str(e)}")
        return None

def set_cache(key: str, value: str, ttl_seconds: Optional[int] = None) -> None:
    """Sets value in Redis cache with an optional TTL (Time-To-Live) in seconds."""
    if not redis_client:
        return
    try:
        if ttl_seconds:
            redis_client.setex(key, ttl_seconds, value)
        else:
            redis_client.set(key, value)
    except Exception as e:
        logger.warning(f"Failed to set cache key '{key}': {str(e)}")

def del_cache(key: str) -> None:
    """Deletes a key from Redis cache."""
    if not redis_client:
        return
    try:
        redis_client.delete(key)
    except Exception as e:
        logger.warning(f"Failed to delete cache key '{key}': {str(e)}")
