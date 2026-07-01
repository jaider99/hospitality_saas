import sys
import logging
from sqlmodel import Session, select
from app.db.session import engine, init_db
from app.db.qdrant import qdrant_client, init_qdrant
from app.db.redis import get_cache, set_cache, del_cache
from app.module.auth.model import User
from app.module.auth.service import get_password_hash
from app.core.config import QDRANT_COLLECTION_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_services")

def verify_postgres():
    logger.info("--- Testing PostgreSQL (SQLModel) ---")
    try:
        init_db()
        with Session(engine) as session:
            # Create a test user
            test_email = "tester@venue.com"
            existing = session.exec(select(User).where(User.email == test_email)).first()
            if existing:
                session.delete(existing)
                session.commit()
                logger.info("Deleted pre-existing test user.")
                
            test_user = User(
                email=test_email,
                supertokens_id="test-supertokens-id",
                name="Tester User",
                role="STAFF"
            )
            session.add(test_user)
            session.commit()
            session.refresh(test_user)
            logger.info(f"Successfully created test user with ID: {test_user.id}")
            
            # Fetch test user
            fetched = session.exec(select(User).where(User.email == test_email)).first()
            if fetched and fetched.name == "Tester User":
                logger.info("Successfully fetched user. Postgres is working!")
                # Clean up
                session.delete(fetched)
                session.commit()
                logger.info("Cleaned up test user successfully.")
                return True
            else:
                logger.error("Failed to retrieve correct user data.")
                return False
    except Exception as e:
        logger.error(f"PostgreSQL verification failed: {str(e)}")
        return False

def verify_qdrant():
    logger.info("--- Testing Qdrant ---")
    try:
        init_qdrant()
        collections_response = qdrant_client.get_collections()
        collection_names = [col.name for col in collections_response.collections]
        
        if QDRANT_COLLECTION_NAME in collection_names:
            logger.info(f"Qdrant collection '{QDRANT_COLLECTION_NAME}' is ready. Qdrant is working!")
            return True
        else:
            logger.error(f"Qdrant collection '{QDRANT_COLLECTION_NAME}' not found.")
            return False
    except Exception as e:
        logger.error(f"Qdrant verification failed: {str(e)}")
        return False

def verify_redis():
    logger.info("--- Testing Redis Cache ---")
    try:
        test_key = "test_verification_key"
        test_value = "caching_is_awesome_123"
        
        set_cache(test_key, test_value, ttl_seconds=10)
        logger.info(f"Set Redis key '{test_key}' with value '{test_value}'")
        
        cached_val = get_cache(test_key)
        logger.info(f"Retrieved Redis value: '{cached_val}'")
        
        if cached_val == test_value:
            logger.info("Redis cache matched! Redis is working!")
            del_cache(test_key)
            return True
        else:
            logger.error("Redis cached value does not match.")
            return False
    except Exception as e:
        logger.error(f"Redis verification failed: {str(e)}")
        return False

def verify_minio():
    logger.info("--- Testing MinIO ---")
    try:
        from app.core.minio import init_minio, get_minio_client
        from app.core.setting import settings
        init_minio()
        client = get_minio_client()
        buckets = client.list_buckets()
        bucket_names = [b["Name"] for b in buckets.get("Buckets", [])]
        if settings.MINIO_BUCKET_NAME in bucket_names:
            logger.info(f"MinIO bucket '{settings.MINIO_BUCKET_NAME}' is ready. MinIO is working!")
            return True
        else:
            logger.error(f"MinIO bucket '{settings.MINIO_BUCKET_NAME}' not found.")
            return False
    except Exception as e:
        logger.error(f"MinIO verification failed: {str(e)}")
        return False

def main():
    pg_ok = verify_postgres()
    qdrant_ok = verify_qdrant()
    redis_ok = verify_redis()
    minio_ok = verify_minio()
    
    logger.info("\n=== VERIFICATION SUMMARY ===")
    logger.info(f"PostgreSQL Integration: {'OK' if pg_ok else 'FAILED'}")
    logger.info(f"Qdrant Integration:     {'OK' if qdrant_ok else 'FAILED'}")
    logger.info(f"Redis Caching:          {'OK' if redis_ok else 'FAILED'}")
    logger.info(f"MinIO Integration:      {'OK' if minio_ok else 'FAILED'}")
    
    if pg_ok and qdrant_ok and redis_ok and minio_ok:
        logger.info("All services verified successfully! \u2705")
        sys.exit(0)
    else:
        logger.error("One or more services failed verification! \u274c")
        sys.exit(1)

if __name__ == "__main__":
    main()
