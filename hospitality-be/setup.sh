#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Starting Hospitality Backend Setup ==="

# 1. Check Python installation
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed. Please install Python 3.9+."
    exit 1
fi

# 2. Create virtual environment
echo "Creating python virtual environment (venv)..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created."
else
    echo "Virtual environment 'venv' already exists."
fi

# 3. Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# 4. Upgrade pip and install dependencies
echo "Upgrading pip and installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

# 5. Initialize and seed database
echo "Initializing schemas and seeding database..."
python3 seed.py

echo ""
echo "=========================================================="
echo " Setup complete successfully! 🎉"
echo "=========================================================="
echo "To start the development server:"
echo "  1. Activate virtual env:  source venv/bin/activate"
echo "  2. Start Uvicorn:         python3 -m uvicorn app.main:app --reload --port 8000"
echo "=========================================================="
echo ""
