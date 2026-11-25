"""training sections limited to organization types

Revision ID: e2b6f0c94d18
Revises: d7a3b9e14c20
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2b6f0c94d18'
down_revision = 'd7a3b9e14c20'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('training_content_items', sa.Column('org_types', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('training_content_items', 'org_types')
