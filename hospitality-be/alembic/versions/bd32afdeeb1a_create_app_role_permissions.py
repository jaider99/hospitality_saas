"""create_app_role_permissions

Revision ID: bd32afdeeb1a
Revises: fc86afdeeb1f
Create Date: 2026-07-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision = 'bd32afdeeb1a'
down_revision = 'fc86afdeeb1f'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('app_role_permissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('role_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('module', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('view', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='None'),
        sa.Column('create', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('edit', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('delete', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('export', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], ['restaurant.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('restaurant_id', 'role_name', 'module', name='uq_app_role_permission_module')
    )
    # op.create_index(op.f('ix_app_role_permissions_restaurant_id'), 'app_role_permissions', ['restaurant_id'], unique=False)
    # op.create_index(op.f('ix_app_role_permissions_role_name'), 'app_role_permissions', ['role_name'], unique=False)
    # op.create_index(op.f('ix_app_role_permissions_module'), 'app_role_permissions', ['module'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_app_role_permissions_module'), table_name='app_role_permissions')
    op.drop_index(op.f('ix_app_role_permissions_role_name'), table_name='app_role_permissions')
    op.drop_index(op.f('ix_app_role_permissions_restaurant_id'), table_name='app_role_permissions')
    op.drop_table('app_role_permissions')
