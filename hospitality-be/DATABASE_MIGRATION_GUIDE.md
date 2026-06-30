# Database Migration Guide - Database Name Change

## Your Situation
You've changed the PostgreSQL database name from **`hospitality_invoices`** to something else.

## Step 1: Update Your Environment Configuration

Update `.env` with the new database name:

```bash
# OLD
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hospitality_invoices?schema=public"

# NEW (replace NEW_DB_NAME with your actual database name)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/NEW_DB_NAME?schema=public"
```

**Example**: If your new database name is `hospitality_saas_prod`:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hospitality_saas_prod?schema=public"
```

---

## Step 2: Choose Your Migration Path

### Option A: Migrate Existing Data (Recommended if data exists)

Use this if you have an **existing database** with data that you want to **preserve**.

#### 2A1. Create the new database in PostgreSQL

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Inside psql:
CREATE DATABASE your_new_db_name;
\q
```

#### 2A2. Dump data from old database

```bash
# Backup old database (if it still exists)
pg_dump -U postgres -h localhost -d hospitality_invoices > backup_hospitality_invoices.sql

# Create new database
createdb -U postgres -h localhost your_new_db_name
```

#### 2A3. Restore data to new database

```bash
# Restore backup to new database
psql -U postgres -h localhost -d your_new_db_name < backup_hospitality_invoices.sql
```

#### 2A4. Run Alembic migrations to ensure schema is up-to-date

```bash
# From the hospitality-be directory
cd /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be

# Update .env with new database name first!

# Run migrations
alembic upgrade head
```

---

### Option B: Create Fresh Database (Recommended if no data)

Use this if you want a **clean slate** with a new database.

#### 2B1. Create the new database

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Inside psql:
CREATE DATABASE your_new_db_name;
\q
```

#### 2B2. Update .env with new database name

```bash
# Replace hospitality_invoices with your_new_db_name
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/your_new_db_name?schema=public"
```

#### 2B3. Initialize database with all migrations

```bash
cd /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be

# Run all migrations from scratch
alembic upgrade head
```

This will create all tables from your current migrations:
- `alembic_version` - Tracks migration history
- `users` - Authentication users
- `suppliers` - Supplier information
- `suppliedproduct` - Products from suppliers
- `productcosthistory` - Price history tracking
- `invoices` - Invoice records
- `invoice_lines` - Line items in invoices
- `invoicetaxbracket` - Tax bracket information
- `recipes` - Recipe management
- `recipeingredient` - Recipe ingredients
- `operationalincident` - Incident tracking
- `staffmember` - Staff/employee records
- `staffshift` - Shift scheduling
- `aiinsight` - AI analysis results

---

## Step 3: Verify the Migration

### Check that tables exist:

```bash
# Connect to your new database
psql -U postgres -h localhost -d your_new_db_name

# Inside psql, list all tables:
\dt

# Should show:
#  Schema |           Name            | Type  |  Owner
# --------+---------------------------+-------+----------
#  public | invoices                  | table | postgres
#  public | invoice_lines             | table | postgres
#  public | invoicetaxbracket         | table | postgres
#  public | suppliers                 | table | postgres
#  public | suppliedproduct           | table | postgres
#  public | productcosthistory        | table | postgres
#  public | recipes                   | table | postgres
#  public | recipeingredient          | table | postgres
#  public | users                     | table | postgres
#  public | operationalincident       | table | postgres
#  public | staffmember               | table | postgres
#  public | staffshift                | table | postgres
#  public | aiinsight                 | table | postgres
#  public | alembic_version           | table | postgres

# Exit
\q
```

### Check migration status:

```bash
cd /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be

# View migration history
alembic current

# View all available migrations
alembic heads
```

---

## Step 4: Test Your Application

### 1. Start the backend server

```bash
cd /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be

# Install dependencies (if needed)
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Test database connection

```bash
# If there's a health/debug endpoint, test it:
curl http://localhost:8000/health

# Or test an authenticated endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/v1/invoices
```

### 3. Verify data integrity (if migrating data)

```bash
# Count records in each table
psql -U postgres -h localhost -d your_new_db_name

SELECT 'invoices' as table_name, COUNT(*) FROM invoices
UNION ALL
SELECT 'invoice_lines', COUNT(*) FROM invoice_lines
UNION ALL
SELECT 'recipes', COUNT(*) FROM recipes
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers;
```

---

## Step 5: Clean Up (Optional)

### Delete old database (if migrating data)

```bash
# CAUTION: This deletes the old database permanently!
psql -U postgres -h localhost

# Inside psql:
DROP DATABASE IF EXISTS hospitality_invoices;
\q
```

### Delete backup file (if migrating data)

```bash
rm backup_hospitality_invoices.sql
```

---

## Troubleshooting

### Issue: "FATAL: database 'hospitality_invoices' does not exist"

**Solution**: You've already changed the database name. Just update `.env` and run migrations on the new database.

### Issue: "permission denied to create database"

**Solution**: Make sure your PostgreSQL user has `CREATEDB` privilege:

```bash
psql -U postgres -h localhost

ALTER USER postgres CREATEDB;
\q
```

### Issue: Alembic says "Can't locate revision identified by 'abc123'"

**Solution**: Your migration history might be corrupted. Reset and run fresh:

```bash
cd /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be

# Downgrade to base (empty database)
alembic downgrade base

# Then upgrade to latest
alembic upgrade head
```

### Issue: Table already exists

**Solution**: You're running migrations on a database that already has tables. This is fine — Alembic will skip already-applied migrations based on `alembic_version` table.

### Issue: Foreign key constraint errors during migration

**Solution**: The tables exist but in wrong order. Drop all tables and recreate:

```bash
psql -U postgres -h localhost -d your_new_db_name

-- CAUTION: This deletes all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;

\q
```

Then run migrations again:

```bash
alembic upgrade head
```

---

## Environment Variables Checklist

Make sure your `.env` has:

```bash
✓ DATABASE_URL with new database name
✓ REDIS_URL (for cache)
✓ QDRANT_URL (for vector DB)
✓ JWT_SECRET
✓ LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
✓ MINIO_* settings (for document storage)
```

---

## Database Schema Overview

Your database includes these main tables:

| Table | Purpose | Relationships |
|-------|---------|---------------|
| `users` | Authentication | - |
| `suppliers` | Supplier info | → `suppliedproduct`, `invoices` |
| `suppliedproduct` | Products | → `productcosthistory`, `invoice_lines` |
| `productcosthistory` | Price history | ← `suppliedproduct` |
| `invoices` | Invoice master | → `invoice_lines`, `invoicetaxbracket` |
| `invoice_lines` | Line items | ← `invoices` |
| `invoicetaxbracket` | Tax details | ← `invoices` |
| `recipes` | Recipe master | → `recipeingredient` |
| `recipeingredient` | Recipe items | ← `recipes`, → `suppliedproduct` |
| `staffmember` | Employee records | → `staffshift` |
| `staffshift` | Shift schedules | ← `staffmember` |
| `operationalincident` | Incident logs | - |
| `aiinsight` | AI analysis | - |

---

## Quick Command Reference

```bash
# Update .env
nano /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be/.env

# Create new database
createdb -U postgres -h localhost your_new_db_name

# Run migrations
cd /Users/tsc/Desktop/git_ocr/hospitality_saas/hospitality-be
alembic upgrade head

# Check migration status
alembic current

# View tables
psql -U postgres -h localhost -d your_new_db_name -c "\dt"

# Start server
python -m uvicorn app.main:app --reload --port 8000
```

---

## Need Help?

If you encounter issues:

1. **Check logs**: `alembic upgrade head -v` (verbose mode)
2. **Verify database exists**: `psql -U postgres -h localhost -l`
3. **Check .env**: Ensure DATABASE_URL is correct
4. **Review migration files**: `/alembic/versions/*.py`
