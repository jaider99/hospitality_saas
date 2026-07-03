"""Merge multiple heads

Revision ID: 99003a8cc82d
Revises: 09b4862800e2, 660aedb5d1ed, c3e6d2fc703b
Create Date: 2026-07-02 18:16:22.622866

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99003a8cc82d'
down_revision: Union[str, Sequence[str], None] = ('09b4862800e2', '660aedb5d1ed', 'c3e6d2fc703b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
