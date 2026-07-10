import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.setting import settings
from app.db.session import init_db
from app.db.qdrant import init_qdrant
from app.core.minio import init_minio

from app.core.supertokens import init_supertokens, create_roles_if_not_exist
from supertokens_python.framework.fastapi import get_middleware
from supertokens_python import get_all_cors_headers

# Initialize SuperTokens configuration
init_supertokens()

# Route imports
from app.api.v1.auth.route import router as auth_router
from app.api.v1.users.route import router as users_router
from app.api.v1.invoices.route import router as invoices_router
from app.api.v1.recipes.route import router as recipes_router
from app.api.v1.labor.route import router as labor_router
from app.api.v1.incidents.route import router as incidents_router
from app.api.v1.ai.route import router as ai_router
from app.api.v1.restaurant.route import router as restaurant_router
from app.api.v1.roles.route import router as roles_router
from app.module.suppliers.router import router as suppliers_router
from app.api.v1.payrolls.route import router as payroll_router
from app.module.products.router import router as products_router
from app.module.categories.router import router as categories_router

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fastapi_app")

app = FastAPI(
    title="Hospitality Decision Intelligence API",
    description="REST API endpoints for the Hospitality SaaS platform (Invoice parsing, recipe margins audit, clock-in labor cost auditing, and Siri-style chatbot RAG queries).",
    version="1.0"
)

# SuperTokens middleware (inner — runs second)
app.add_middleware(get_middleware())

# CORS middleware (outer — runs first, handles OPTIONS preflight before SuperTokens)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.WEBSITE_DOMAIN,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.26:3000",   # Local network (current dev machine)
        "http://192.168.29.73:3000",  # Legacy local network fallback
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
)

# Global Startup event
@app.on_event("startup")
async def on_startup():
    logger.info("Starting Hospitality backend service...")
    # Initialize SQL Database tables
    logger.info("Skipping SQL Database schema creation (managed by Alembic)")
    # init_db()
    # Initialize Qdrant Collection
    try:
        logger.info("Initializing Qdrant Vector Collection...")
        init_qdrant()
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant: {e}")
        
    # Initialize MinIO Bucket
    try:
        logger.info("Initializing MinIO Bucket...")
        init_minio()
    except Exception as e:
        logger.error(f"Failed to initialize MinIO: {e}")

    # Create default roles in SuperTokens core
    await create_roles_if_not_exist()
    logger.info("Startup complete. Service is running.")

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from supertokens_python.exceptions import SuperTokensError

# Global Exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, (StarletteHTTPException, RequestValidationError, SuperTokensError)):
        raise exc
    logger.error(f"Unhandled exception occurred on path {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"status": "error", "message": f"An internal server error occurred: {str(exc)}"}
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
app.include_router(users_router, prefix="/api/v1/users", tags=["Users Management"])
app.include_router(invoices_router, prefix="/api/v1/invoices", tags=["Invoices"])
app.include_router(recipes_router, prefix="/api/v1/recipes", tags=["Recipes"])
app.include_router(labor_router, prefix="/api/v1/labor", tags=["Labor Cost Auditing"])
app.include_router(incidents_router, prefix="/api/v1/incidents", tags=["Operational Incidents"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["Decision AI & Chatbot"])
app.include_router(restaurant_router, prefix="/api/v1/restaurant", tags=["Restaurant Management"])
app.include_router(roles_router, prefix="/api/v1/roles", tags=["Roles & Permissions"])
app.include_router(suppliers_router, prefix="/api/v1/suppliers", tags=["Suppliers"])
app.include_router(payroll_router, prefix="/api/v1/payrolls", tags=["Payrolls"])
app.include_router(products_router, prefix="/api/v1", tags=["Products & Inventory"])
app.include_router(categories_router, prefix="/api/v1/categories", tags=["Categories"])
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
