"""activity reminder / overdue notification markers

Revision ID: b5e9c3f07a12
Revises: a7d4e2c19f05
"""
from alembic import op
import sqlalchemy as sa

revision = 'b5e9c3f07a12'
down_revision = 'a7d4e2c19f05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sop_activities', sa.Column('reminder_sent_at', sa.DateTime(), nullable=True))
    op.add_column('sop_activities', sa.Column('overdue_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('sop_activities', 'overdue_sent_at')
    op.drop_column('sop_activities', 'reminder_sent_at')
