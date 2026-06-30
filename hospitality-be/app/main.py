import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.setting import settings
from app.db.session import init_db
from app.db.qdrant import init_qdrant
from app.core.minio import init_minio

# Route imports
from app.api.v1.auth.route import router as auth_router
from app.api.v1.invoices.route import router as invoices_router
from app.api.v1.recipes.route import router as recipes_router
from app.api.v1.labor.route import router as labor_router
from app.api.v1.incidents.route import router as incidents_router
from app.api.v1.ai.route import router as ai_router

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fastapi_app")

app = FastAPI(
    title="Hospitality Decision Intelligence API",
    description="REST API endpoints for the Hospitality SaaS platform (Invoice parsing, recipe margins audit, clock-in labor cost auditing, and Siri-style chatbot RAG queries).",
    version="1.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
)

# Global Startup event
@app.on_event("startup")
def on_startup():
    logger.info("Starting Hospitality backend service...")
    # Initialize SQL Database tables
    logger.info("Initializing SQL Database schema...")
    init_db()
    # Initialize Qdrant Collection
    logger.info("Initializing Qdrant Vector Collection...")
    init_qdrant()
    # Initialize MinIO Bucket
    logger.info("Initializing MinIO Bucket...")
    init_minio()
    logger.info("Startup complete. Service is running.")

# Global Exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception occurred on path {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"status": "error", "message": "An internal server error occurred."}
    )

# Root status check
@app.get("/")
def read_root():
    return {
        "status": "success",
        "message": "Hospitality Decision Intelligence API is running.",
        "docs": "/docs"
    }

# Include routers matching NestJS endpoint parity
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(invoices_router, prefix="/api/v1/invoices", tags=["Invoices"])
app.include_router(recipes_router, prefix="/api/v1/recipes", tags=["Recipes"])
app.include_router(labor_router, prefix="/api/v1/labor", tags=["Labor Cost Auditing"])
app.include_router(incidents_router, prefix="/api/v1/incidents", tags=["Operational Incidents"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["Decision AI & Chatbot"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
