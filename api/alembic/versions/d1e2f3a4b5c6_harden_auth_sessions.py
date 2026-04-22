"""harden auth sessions

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6, f8c9d0e1a2b3
Create Date: 2026-04-19 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, tuple[str, str], None] = (
    "c1d2e3f4a5b6",
    "f8c9d0e1a2b3",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auth_sessions",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "auth_sessions",
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        """
        UPDATE auth_sessions
        SET
            expires_at = COALESCE(expires_at, created_at + INTERVAL '14 days'),
            last_used_at = COALESCE(last_used_at, created_at)
        """
    )

    op.alter_column("auth_sessions", "expires_at", nullable=False)
    op.alter_column("auth_sessions", "last_used_at", nullable=False)
    op.create_index(
        "ix_auth_sessions_expires_at",
        "auth_sessions",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_expires_at", table_name="auth_sessions")
    op.drop_column("auth_sessions", "last_used_at")
    op.drop_column("auth_sessions", "expires_at")
