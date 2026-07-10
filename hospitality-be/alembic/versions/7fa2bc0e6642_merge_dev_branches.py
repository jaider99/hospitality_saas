"""Merge dev branches

Revision ID: 7fa2bc0e6642
Revises: 1b20cfbc47b7, 98341f812d41
Create Date: 2026-07-10 10:36:09.458251

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fa2bc0e6642'
down_revision: Union[str, Sequence[str], None] = ('1b20cfbc47b7', '98341f812d41')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
