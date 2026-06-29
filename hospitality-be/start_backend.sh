#!/usr/bin/env bash
source venv/bin/activate
mkdir -p logs

echo "Starting Uvicorn API server..."
python3 -m uvicorn app.main:app --reload --port 8000 > logs/api.log 2>&1 &
API_PID=$!

echo "Starting ARQ Background Worker (OCR & AI)..."
python3 -m arq app.worker.WorkerSettings > logs/worker.log 2>&1 &
WORKER_PID=$!

echo "Both services are running in the background."
echo "API PID: $API_PID | Worker PID: $WORKER_PID"
echo "You can view the logs cleanly using the following command:"
echo "tail -f logs/api.log logs/worker.log"

# Wait for both processes
trap "kill $API_PID $WORKER_PID; exit" SIGINT SIGTERM
wait
