"""add_app_category_id_to_products

Revision ID: b6da10406dbf
Revises: 8f62db44eab7
Create Date: 2026-07-06 12:19:53.459423

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6da10406dbf'
down_revision: Union[str, Sequence[str], None] = '8f62db44eab7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Only add the new app_category_id column to products and its FK
    op.add_column('products', sa.Column('app_category_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_products_app_category_id'), 'products', ['app_category_id'], unique=False)
    op.create_foreign_key('fk_products_app_category_id', 'products', 'categories', ['app_category_id'], ['category_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_products_app_category_id', 'products', type_='foreignkey')
    op.drop_index(op.f('ix_products_app_category_id'), table_name='products')
    op.drop_column('products', 'app_category_id')
