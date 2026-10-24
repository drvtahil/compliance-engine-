"""remove length limits from free-text columns

Revision ID: d7a3b9e14c20
Revises: c5d01260d3b3
"""
from alembic import op
import sqlalchemy as sa

revision = 'd7a3b9e14c20'
down_revision = 'c5d01260d3b3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('legal_chapters','title',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('legal_sections','section_title',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('legal_assessments','industry_process',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('legal_assessments','sop_name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('training_courses','name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('training_modules','module_name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('training_modules','chapter',type_=sa.Text(),existing_type=sa.String(),existing_nullable=True)
    op.alter_column('training_content_items','title',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('training_assignments','title',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('compliance_sections','name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('resources_documents','title',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('resources_documents','section_name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('sop_activities','activity_name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('sop_files','name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)
    op.alter_column('sop_files','type_name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=True)
    op.alter_column('sop_files','process_name',type_=sa.Text(),existing_type=sa.String(),existing_nullable=True)
    op.alter_column('notifications','title',type_=sa.Text(),existing_type=sa.String(),existing_nullable=False)


def downgrade() -> None:
    pass
