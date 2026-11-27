"""SOP numbers only for questions that have an SOP name; renumber once

Revision ID: a7d4e2c19f05
Revises: f3c8a1d27b90
"""
from alembic import op

revision = 'a7d4e2c19f05'
down_revision = 'f3c8a1d27b90'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE legal_assessments SET sop_no = NULL WHERE COALESCE(TRIM(sop_name), '') = ''")
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
            WHERE COALESCE(TRIM(a.sop_name), '') <> ''
        ) n
        WHERE la.id = n.id
    """)


def downgrade() -> None:
    pass
