import os
from dotenv import load_dotenv
load_dotenv()

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/hospitality?schema=public"
    QDRANT_URL: str = "http://localhost:6333"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = "super-secret-key-123"
    GEMINI_API_KEY: str = "dummy-key"
    OPENAI_API_KEY: str = ""          # Used by OCR pipeline LLM fallback
    PORT: int = 8000
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    MINIO_ENDPOINT_URL: str = "http://localhost:9010"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "invoices"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
