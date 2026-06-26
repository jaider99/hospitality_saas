import logging
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from app.core.setting import settings
from app.core.config import QDRANT_COLLECTION_NAME

logger = logging.getLogger("qdrant_client")

# Initialize Qdrant Client
qdrant_client = QdrantClient(url=settings.QDRANT_URL, check_compatibility=False)

def init_qdrant():
    """Initializes the Qdrant vector database and ensures the collection exists."""
    logger.info(f"Connecting to Qdrant at: {settings.QDRANT_URL}")
    try:
        # Check if the collection exists
        collections_response = qdrant_client.get_collections()
        collection_names = [col.name for col in collections_response.collections]
        
        if QDRANT_COLLECTION_NAME not in collection_names:
            logger.info(f"Creating collection '{QDRANT_COLLECTION_NAME}' in Qdrant...")
            # Create collection configured for 768-dimensional embeddings (Gemini text-embedding-004)
            qdrant_client.create_collection(
                collection_name=QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=768,
                    distance=Distance.COSINE
                )
            )
            logger.info(f"Collection '{QDRANT_COLLECTION_NAME}' created successfully.")
        else:
            logger.info(f"Collection '{QDRANT_COLLECTION_NAME}' already exists in Qdrant.")
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant collection: {str(e)}")
        # Graceful fallback, we will log errors but not crash startup
