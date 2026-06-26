from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.setting import settings

# Create engine. Since we are using standard Postgres via psycopg2, standard thread-pooling works fine.
db_url = settings.DATABASE_URL
if "?" in db_url:
    db_url = db_url.split("?")[0]

engine = create_engine(db_url, echo=False)

# Async database configuration
async_db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(async_db_url, echo=False)

async_session_maker = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)

def init_db():
    """Creates all database tables defined in the modules."""
    # Models must be imported before calling create_all
    SQLModel.metadata.create_all(engine)

def get_db():
    """FastAPI Dependency for database session."""
    with Session(engine) as session:
        yield session

async def get_async_db():
    """FastAPI Dependency for asynchronous database session."""
    async with async_session_maker() as session:
        yield session

