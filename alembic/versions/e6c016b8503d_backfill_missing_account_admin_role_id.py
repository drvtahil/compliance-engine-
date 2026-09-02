"""backfill missing account admin role_id

Revision ID: e6c016b8503d
Revises: 72278a6cf5c3
Create Date: 2026-09-02 16:10:47.317195

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6c016b8503d'
down_revision: Union[str, Sequence[str], None] = '72278a6cf5c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    account_admin_role_id = conn.execute(
        sa.text("SELECT id FROM roles WHERE role_name = 'Account Admin'")
    ).scalar()
    conn.execute(
        sa.text("UPDATE account_admins SET role_id = :role_id WHERE role_id IS NULL"),
        {"role_id": account_admin_role_id},
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Not reversible: we can no longer tell which rows were originally NULL.
    pass
