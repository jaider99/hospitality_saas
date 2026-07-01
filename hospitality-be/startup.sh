#!/usr/bin/env bash
# Production startup command for FastAPI backend on Azure App Service or Docker containers
echo "Starting FastAPI application on port 8000..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
