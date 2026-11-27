"""stored SOP numbers per Act (SOP-001, SOP-002 ...)

Revision ID: f3c8a1d27b90
Revises: e2b6f0c94d18
"""
from alembic import op
import sqlalchemy as sa

revision = 'f3c8a1d27b90'
down_revision = 'e2b6f0c94d18'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('legal_assessments', sa.Column('sop_no', sa.Integer(), nullable=True))
    # Number existing SOPs 1..N per Act, in chapter -> rule -> section -> question order.
    op.execute("""
        UPDATE legal_assessments la SET sop_no = n.rn
        FROM (
            SELECT a.id, ROW_NUMBER() OVER (
                PARTITION BY c.act_code ORDER BY c.id, r.rule_order, r.id, s.id, a.id
            ) AS rn
            FROM legal_assessments a
            JOIN legal_sections s ON s.id = a.section_id
            JOIN legal_rules r ON r.id = s.rule_id
            JOIN legal_chapters c ON c.id = r.chapter_id
        ) n
        WHERE la.id = n.id
    """)


def downgrade() -> None:
    op.drop_column('legal_assessments', 'sop_no')
