"""Add is_duplicate to invoice

Revision ID: 09b4862800e2
Revises: c964c0773328
Create Date: 2026-07-02 12:45:44.555319

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09b4862800e2'
down_revision: Union[str, Sequence[str], None] = 'c964c0773328'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('invoices', sa.Column('is_duplicate', sa.Boolean(), nullable=True, server_default=sa.text('false')))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('invoices', 'is_duplicate')
