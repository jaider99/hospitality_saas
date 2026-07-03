# Alembic Migration Rule
When tasked with generating database migrations:
1. **Always use the CLI command** (e.g., `python -m alembic revision --autogenerate -m "..."`) to generate the migration file. Never attempt to manually create or write the migration file content yourself.
2. **Only generate the file**. Do NOT automatically apply the migration (e.g., do not run `alembic upgrade head`) unless the user explicitly asks you to do so.
