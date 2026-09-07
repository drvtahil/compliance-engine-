"""fix account_admin delete fk ondelete rules

Revision ID: c3d8f4a1b2e5
Revises: 0aa451b79c43
Create Date: 2026-09-07 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d8f4a1b2e5'
down_revision: Union[str, Sequence[str], None] = '0aa451b79c43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Having only created another user is not a "footprint" — deleting the
    # creator should just clear the reference, not block the delete.
    op.drop_constraint('fk_account_admins_created_by_account_admins', 'account_admins', type_='foreignkey')
    op.create_foreign_key(
        'fk_account_admins_created_by_account_admins', 'account_admins', 'account_admins',
        ['created_by'], ['id'], ondelete='SET NULL',
    )

    # Having SOPs/questions allocated to you is a footprint and should block
    # deletion (via app-level check), not silently cascade-delete the
    # allocation history when the admin row is removed.
    op.drop_constraint('question_assignments_assigned_user_id_fkey', 'question_assignments', type_='foreignkey')
    op.create_foreign_key(
        'question_assignments_assigned_user_id_fkey', 'question_assignments', 'account_admins',
        ['assigned_user_id'], ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('question_assignments_assigned_user_id_fkey', 'question_assignments', type_='foreignkey')
    op.create_foreign_key(
        'question_assignments_assigned_user_id_fkey', 'question_assignments', 'account_admins',
        ['assigned_user_id'], ['id'], ondelete='CASCADE',
    )

    op.drop_constraint('fk_account_admins_created_by_account_admins', 'account_admins', type_='foreignkey')
    op.create_foreign_key(
        'fk_account_admins_created_by_account_admins', 'account_admins', 'account_admins',
        ['created_by'], ['id'],
    )
