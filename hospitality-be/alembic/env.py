from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.core.setting import settings
from sqlmodel import SQLModel

# Import all models here so they are registered with SQLModel.metadata
from app.module.auth.model import User, RolePermission
from app.module.invoices.model import Supplier, SuppliedProduct, ProductCostHistory, Invoice, InvoiceLine, InvoiceTaxBracket, SupplierContact
from app.module.recipes.model import Recipe, RecipeIngredient
from app.module.incidents.model import OperationalIncident
from app.module.labor.model import StaffMember, StaffShift
from app.module.ai.model import AIInsight
from app.module.payroll.model import StaffPosition, StaffRole, StaffEmployee, MonthlyPayroll
from app.module.categories.model import Category
from app.module.products.model import (
    ExpenseCategory, Product, ProductSupplier,
    ProductAlias, ProductFormat,
    Inventory, InventoryItem,
)

# Import OCR storage models as well
from app.ocr.storage import Base as OCRBase

# We need to manage both SQLModel metadata and OCR SQLAlchemy metadata
# Alternatively, since we use same database, we can just point to one if we merged them,
# but we have two metadatas now. Let's create a combined metadata or just use one.
target_metadata = SQLModel.metadata

db_url = settings.DATABASE_URL
if "?" in db_url:
    db_url = db_url.split("?")[0]
config.set_main_option("sqlalchemy.url", db_url)
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
