from setuptools import setup, find_packages

setup(
    name="hospitality-be",
    version="1.0.0",
    description="Hospitality Decision Intelligence Python Backend Service",
    author="Venue Team",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "fastapi>=0.110.0",
        "uvicorn>=0.28.0",
        "sqlmodel>=0.0.16",
        "pydantic-settings>=2.2.1",
        "qdrant-client>=1.8.0",
        "redis>=5.0.3",
        "google-genai>=0.1.1",
        "google-generativeai>=0.4.1",
        "bcrypt>=4.1.2",
        "pyjwt>=2.8.0",
        "python-multipart>=0.0.9",
        "python-dotenv>=1.0.1",
        "psycopg2-binary>=2.9.9",
        "email-validator>=2.0.0",
    ],
)
