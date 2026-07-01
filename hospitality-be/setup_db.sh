#!/usr/bin/env bash

# Exit on error
set -e

# Change directory to the script's directory (hospitality-be)
cd "$(dirname "$0")"

# Detect Python interpreter from virtual environment
if [ -n "$VIRTUAL_ENV" ] && [ -f "$VIRTUAL_ENV/bin/python" ]; then
  PYTHON="$VIRTUAL_ENV/bin/python"
elif [ -n "$VIRTUAL_ENV" ] && [ -f "$VIRTUAL_ENV/Scripts/python" ]; then
  PYTHON="$VIRTUAL_ENV/Scripts/python"
elif [ -f "./venv/bin/python" ]; then
  PYTHON="./venv/bin/python"
elif [ -f "./venv/Scripts/python" ]; then
  PYTHON="./venv/Scripts/python"
elif [ -f "./.venv/bin/python" ]; then
  PYTHON="./.venv/bin/python"
elif [ -f "./.venv/Scripts/python" ]; then
  PYTHON="./.venv/Scripts/python"
else
  echo "Warning: No virtual environment found in ./venv or ./.venv. Falling back to system 'python3'."
  PYTHON="python3"
fi

# 1. Run migrations to get the latest schema
echo "=== Running Database Migrations ==="
$PYTHON -m alembic upgrade head

# 2. Optionally seed the database if the --seed or -s flag is provided
if [[ "$1" == "--seed" || "$1" == "-s" ]]; then
  echo "=== Seeding Database ==="
  $PYTHON seed.py
fi

echo "=== Database setup completed successfully! ==="
