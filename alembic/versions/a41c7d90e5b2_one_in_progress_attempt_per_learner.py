"""one in-progress attempt per learner per assignment

Revision ID: a41c7d90e5b2
Revises: 39ce72f66f96
Create Date: 2026-09-19 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a41c7d90e5b2'
down_revision: Union[str, None] = '39ce72f66f96'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'uq_training_attempt_one_in_progress', 'training_attempts',
        ['assignment_id', 'admin_id'], unique=True,
        postgresql_where=sa.text("status = 'in_progress'"),
    )


def downgrade() -> None:
    op.drop_index('uq_training_attempt_one_in_progress', table_name='training_attempts')
