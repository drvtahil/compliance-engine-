"""scope resources sections and documents to an act

Revision ID: f8839f9284fd
Revises: 0f37d9fafe37
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8839f9284fd'
down_revision: Union[str, Sequence[str], None] = '0f37d9fafe37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_ACT = "DPDPA 2023"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('compliance_sections', sa.Column('act_code', sa.String(length=100), nullable=True))
    op.add_column('resources_documents', sa.Column('act_code', sa.String(length=100), nullable=True))

    op.execute(f"UPDATE compliance_sections SET act_code = '{DEFAULT_ACT}' WHERE act_code IS NULL")
    op.execute(f"UPDATE resources_documents SET act_code = '{DEFAULT_ACT}' WHERE act_code IS NULL")

    op.alter_column('compliance_sections', 'act_code', nullable=False)
    op.alter_column('resources_documents', 'act_code', nullable=False)

    op.create_index('ix_compliance_sections_act_code', 'compliance_sections', ['act_code'])
    op.create_index('ix_resources_documents_act_code', 'resources_documents', ['act_code'])

    op.drop_constraint('compliance_sections_name_key', 'compliance_sections', type_='unique')
    op.create_unique_constraint('uq_compliance_section_act_name', 'compliance_sections', ['act_code', 'name'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_compliance_section_act_name', 'compliance_sections', type_='unique')
    op.create_unique_constraint('compliance_sections_name_key', 'compliance_sections', ['name'])

    op.drop_index('ix_resources_documents_act_code', table_name='resources_documents')
    op.drop_index('ix_compliance_sections_act_code', table_name='compliance_sections')

    op.drop_column('resources_documents', 'act_code')
    op.drop_column('compliance_sections', 'act_code')
