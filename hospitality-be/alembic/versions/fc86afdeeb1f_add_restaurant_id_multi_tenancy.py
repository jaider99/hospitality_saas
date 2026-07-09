"""Add restaurant_id multi-tenancy

Revision ID: fc86afdeeb1f
Revises: 6ec860245f38
Create Date: 2026-07-08 11:31:33.203569

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = 'fc86afdeeb1f'
down_revision: Union[str, Sequence[str], None] = '4a03a0b80781'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add restaurant_id to categories
    op.add_column('categories', sa.Column('restaurant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_categories_restaurant_id'), 'categories', ['restaurant_id'], unique=False)
    op.create_foreign_key('fk_categories_restaurant_id', 'categories', 'restaurant', ['restaurant_id'], ['id'])
    
    op.drop_index('ix_categories_name', table_name='categories')
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=False)
    op.create_unique_constraint('uq_category_restaurant_name', 'categories', ['restaurant_id', 'name'])

    # 2. Add restaurant_id to invoices
    op.add_column('invoices', sa.Column('restaurant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_invoices_restaurant_id'), 'invoices', ['restaurant_id'], unique=False)
    op.create_foreign_key('fk_invoices_restaurant_id', 'invoices', 'restaurant', ['restaurant_id'], ['id'])

    # 3. Add restaurant_id to recipe
    op.add_column('recipe', sa.Column('restaurant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_recipe_restaurant_id'), 'recipe', ['restaurant_id'], unique=False)
    op.create_foreign_key('fk_recipe_restaurant_id', 'recipe', 'restaurant', ['restaurant_id'], ['id'])

    # 4. Add restaurant_id to recipetag
    op.add_column('recipetag', sa.Column('restaurant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_recipetag_restaurant_id'), 'recipetag', ['restaurant_id'], unique=False)
    op.create_foreign_key('fk_recipetag_restaurant_id', 'recipetag', 'restaurant', ['restaurant_id'], ['id'])
    
    op.drop_index('ix_recipetag_tag_id', table_name='recipetag')
    op.create_index(op.f('ix_recipetag_tag_id'), 'recipetag', ['tag_id'], unique=False)
    op.create_unique_constraint('uq_recipetag_restaurant_tagid', 'recipetag', ['restaurant_id', 'tag_id'])

    # 5. Add restaurant_id to suppliers
    op.add_column('suppliers', sa.Column('restaurant_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_suppliers_restaurant_id'), 'suppliers', ['restaurant_id'], unique=False)
    op.create_foreign_key('fk_suppliers_restaurant_id', 'suppliers', 'restaurant', ['restaurant_id'], ['id'])

    # 6. Data Migration: Assign existing records to the first user's restaurant
    conn = op.get_bind()
    # Find first user's restaurant_id
    res = conn.execute(sa.text('SELECT restaurant_id FROM "user" WHERE restaurant_id IS NOT NULL LIMIT 1')).fetchone()
    if res and res[0]:
        first_restaurant_id = res[0]
        # Update existing records
        conn.execute(sa.text(f"UPDATE categories SET restaurant_id = {first_restaurant_id} WHERE restaurant_id IS NULL"))
        conn.execute(sa.text(f"UPDATE invoices SET restaurant_id = {first_restaurant_id} WHERE restaurant_id IS NULL"))
        conn.execute(sa.text(f"UPDATE recipe SET restaurant_id = {first_restaurant_id} WHERE restaurant_id IS NULL"))
        conn.execute(sa.text(f"UPDATE recipetag SET restaurant_id = {first_restaurant_id} WHERE restaurant_id IS NULL"))
        conn.execute(sa.text(f"UPDATE suppliers SET restaurant_id = {first_restaurant_id} WHERE restaurant_id IS NULL"))

def downgrade() -> None:
    # 5. Suppliers
    op.drop_constraint('fk_suppliers_restaurant_id', 'suppliers', type_='foreignkey')
    op.drop_index(op.f('ix_suppliers_restaurant_id'), table_name='suppliers')
    op.drop_column('suppliers', 'restaurant_id')

    # 4. RecipeTag
    op.drop_constraint('uq_recipetag_restaurant_tagid', 'recipetag', type_='unique')
    op.drop_index(op.f('ix_recipetag_tag_id'), table_name='recipetag')
    op.create_index('ix_recipetag_tag_id', 'recipetag', ['tag_id'], unique=True)
    op.drop_constraint('fk_recipetag_restaurant_id', 'recipetag', type_='foreignkey')
    op.drop_index(op.f('ix_recipetag_restaurant_id'), table_name='recipetag')
    op.drop_column('recipetag', 'restaurant_id')

    # 3. Recipe
    op.drop_constraint('fk_recipe_restaurant_id', 'recipe', type_='foreignkey')
    op.drop_index(op.f('ix_recipe_restaurant_id'), table_name='recipe')
    op.drop_column('recipe', 'restaurant_id')

    # 2. Invoices
    op.drop_constraint('fk_invoices_restaurant_id', 'invoices', type_='foreignkey')
    op.drop_index(op.f('ix_invoices_restaurant_id'), table_name='invoices')
    op.drop_column('invoices', 'restaurant_id')

    # 1. Categories
    op.drop_constraint('uq_category_restaurant_name', 'categories', type_='unique')
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.create_index('ix_categories_name', 'categories', ['name'], unique=True)
    op.drop_constraint('fk_categories_restaurant_id', 'categories', type_='foreignkey')
    op.drop_index(op.f('ix_categories_restaurant_id'), table_name='categories')
    op.drop_column('categories', 'restaurant_id')
