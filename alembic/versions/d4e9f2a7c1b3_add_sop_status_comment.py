"""add sop status comment

Revision ID: d4e9f2a7c1b3
Revises: c3d8f4a1b2e5
Create Date: 2026-09-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e9f2a7c1b3'
down_revision: Union[str, Sequence[str], None] = 'c3d8f4a1b2e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sop_statuses', sa.Column('comment', sa.Text(), nullable=True))
    op.add_column('sop_statuses', sa.Column('comment_updated_by', sa.Integer(), nullable=True))
    op.add_column('sop_statuses', sa.Column('comment_updated_at', sa.DateTime(), nullable=True))
    op.create_foreign_key(
        'fk_sop_statuses_comment_updated_by_account_admins', 'sop_statuses', 'account_admins',
        ['comment_updated_by'], ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_sop_statuses_comment_updated_by_account_admins', 'sop_statuses', type_='foreignkey')
    op.drop_column('sop_statuses', 'comment_updated_at')
    op.drop_column('sop_statuses', 'comment_updated_by')
    op.drop_column('sop_statuses', 'comment')
