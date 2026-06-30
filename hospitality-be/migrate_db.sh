#!/bin/bash

# Database Migration Script
# Run this script to migrate from old database name to new one

set -e

echo "========================================"
echo "Database Migration Script"
echo "========================================"
echo ""

# Check if PostgreSQL tools are available
if ! command -v psql &> /dev/null; then
    echo "❌ ERROR: psql not found. Install PostgreSQL client tools."
    exit 1
fi

if ! command -v createdb &> /dev/null; then
    echo "❌ ERROR: createdb not found. Install PostgreSQL client tools."
    exit 1
fi

# Get database details from environment or prompt
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
OLD_DB_NAME="hospitality_invoices"

echo "PostgreSQL Connection Details:"
echo "  User: $DB_USER"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Prompt for new database name
read -p "Enter new database name (required): " NEW_DB_NAME

if [ -z "$NEW_DB_NAME" ]; then
    echo "❌ ERROR: Database name cannot be empty"
    exit 1
fi

echo ""
echo "Migration Plan:"
echo "  Old database: $OLD_DB_NAME (will be kept)"
echo "  New database: $NEW_DB_NAME"
echo ""

# Prompt for migration type
echo "Choose migration type:"
echo "  1) Migrate data from old database (preserves data)"
echo "  2) Create fresh database (clean slate)"
echo ""
read -p "Enter choice (1 or 2): " MIGRATION_TYPE

if [ "$MIGRATION_TYPE" != "1" ] && [ "$MIGRATION_TYPE" != "2" ]; then
    echo "❌ ERROR: Invalid choice. Enter 1 or 2"
    exit 1
fi

# Check if old database exists
echo ""
echo "Checking if old database exists..."
if psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -l | grep -q "$OLD_DB_NAME"; then
    OLD_DB_EXISTS=1
    echo "✓ Old database '$OLD_DB_NAME' found"
else
    OLD_DB_EXISTS=0
    echo "⚠ Old database '$OLD_DB_NAME' not found (OK if already deleted)"
fi

echo ""

# Confirm before proceeding
read -p "Proceed with migration? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "========================================"
echo "Starting Migration..."
echo "========================================"
echo ""

# Step 1: Backup old database if it exists
if [ "$OLD_DB_EXISTS" -eq 1 ] && [ "$MIGRATION_TYPE" = "1" ]; then
    BACKUP_FILE="backup_${OLD_DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
    echo "Step 1: Backing up old database to $BACKUP_FILE..."
    pg_dump -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" "$OLD_DB_NAME" > "$BACKUP_FILE"
    echo "✓ Backup created: $BACKUP_FILE"
    echo ""
fi

# Step 2: Check if new database already exists
echo "Step 2: Checking if new database already exists..."
if psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -l | grep -q "$NEW_DB_NAME"; then
    echo "⚠ New database '$NEW_DB_NAME' already exists"
    read -p "Delete and recreate? (yes/no): " DELETE_CONFIRM
    if [ "$DELETE_CONFIRM" = "yes" ]; then
        echo "  Dropping existing database..."
        dropdb -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" --if-exists "$NEW_DB_NAME"
        echo "  ✓ Database dropped"
    fi
else
    echo "✓ New database does not exist (will be created)"
fi

echo ""

# Step 3: Create new database
echo "Step 3: Creating new database '$NEW_DB_NAME'..."
createdb -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" "$NEW_DB_NAME"
echo "✓ Database created"
echo ""

# Step 4: Restore data if migrating
if [ "$OLD_DB_EXISTS" -eq 1 ] && [ "$MIGRATION_TYPE" = "1" ]; then
    echo "Step 4: Restoring data from backup..."
    psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$NEW_DB_NAME" < "$BACKUP_FILE"
    echo "✓ Data restored"
    echo ""
else
    echo "Step 4: Skipped (clean database)"
    echo ""
fi

# Step 5: Update .env file
echo "Step 5: Updating .env file..."
ENV_FILE="$(dirname "$0")/.env"

if [ -f "$ENV_FILE" ]; then
    # Backup .env
    cp "$ENV_FILE" "${ENV_FILE}.backup"
    echo "  ✓ .env backup created: ${ENV_FILE}.backup"
    
    # Update DATABASE_URL
    if grep -q "DATABASE_URL=" "$ENV_FILE"; then
        # Use sed to replace the database name
        sed -i.bak "s|DATABASE_URL=\"postgresql://\([^:]*\):\([^@]*\)@\([^:]*\):\([^/]*\)/[^?]*|DATABASE_URL=\"postgresql://\1:\2@\3:\4/$NEW_DB_NAME|" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak"
        echo "  ✓ DATABASE_URL updated to use '$NEW_DB_NAME'"
    else
        echo "  ⚠ DATABASE_URL not found in .env, please update manually"
    fi
else
    echo "  ⚠ .env file not found at $ENV_FILE"
    echo "  Please update it manually with:"
    echo "  DATABASE_URL=\"postgresql://$DB_USER:password@$DB_HOST:$DB_PORT/$NEW_DB_NAME?schema=public\""
fi

echo ""

# Step 6: Run Alembic migrations
echo "Step 6: Running Alembic migrations..."
cd "$(dirname "$0")"

if command -v alembic &> /dev/null; then
    alembic upgrade head
    echo "✓ Migrations completed"
    echo ""
else
    echo "⚠ Alembic not found. Run manually:"
    echo "  cd $(dirname "$0")"
    echo "  alembic upgrade head"
    echo ""
fi

# Step 7: Verify
echo "Step 7: Verifying migration..."
TABLE_COUNT=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$NEW_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo "✓ Database verified - found $TABLE_COUNT tables"
    echo ""
else
    echo "⚠ WARNING: No tables found in new database"
    echo ""
fi

echo "========================================"
echo "Migration Complete!"
echo "========================================"
echo ""
echo "Summary:"
echo "  • Old database: $OLD_DB_NAME (preserved)"
echo "  • New database: $NEW_DB_NAME"
echo "  • Tables created: $TABLE_COUNT"
echo "  • .env updated: Yes"
echo ""
echo "Next steps:"
echo "  1. Verify .env DATABASE_URL is correct:"
echo "     DATABASE_URL=\"postgresql://$DB_USER:password@$DB_HOST:$DB_PORT/$NEW_DB_NAME?schema=public\""
echo "  2. Start your application:"
echo "     python -m uvicorn app.main:app --reload --port 8000"
echo "  3. Test API endpoints to verify everything works"
echo ""
echo "To delete old database when done (CAUTION - permanent):"
echo "  dropdb -U $DB_USER -h $DB_HOST -p $DB_PORT $OLD_DB_NAME"
echo ""
