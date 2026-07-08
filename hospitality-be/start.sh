#!/bin/bash

# Start the FastAPI backend
echo "Starting FastAPI backend on port 8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start the ARQ background worker
echo "Starting ARQ background worker..."
python -m arq app.worker.WorkerSettings &
WORKER_PID=$!

# Monitor both processes. If either exits, kill the other and exit the container
while true; do
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "FastAPI backend has terminated. Exiting container..."
    kill $WORKER_PID 2>/dev/null
    exit 1
  fi
  
  if ! kill -0 $WORKER_PID 2>/dev/null; then
    echo "ARQ worker has terminated. Exiting container..."
    kill $BACKEND_PID 2>/dev/null
    exit 1
  fi
  
  sleep 5
done
