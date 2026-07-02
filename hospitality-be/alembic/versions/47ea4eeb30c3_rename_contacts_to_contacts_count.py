"""rename_contacts_to_contacts_count

Revision ID: 47ea4eeb30c3
Revises: 3d4d4a7ae06e
Create Date: 2026-07-02 12:36:39.084581

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '47ea4eeb30c3'
down_revision: Union[str, Sequence[str], None] = '3d4d4a7ae06e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename suppliers.contacts to suppliers.contacts_count."""
    op.alter_column('suppliers', 'contacts', new_column_name='contacts_count')


def downgrade() -> None:
    """Revert rename."""
    op.alter_column('suppliers', 'contacts_count', new_column_name='contacts')
