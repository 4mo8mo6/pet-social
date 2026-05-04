"""add pet avatar generation fields

Revision ID: e6a1b2c3d4f5
Revises: d1e2f3a4b5c6
Create Date: 2026-04-22 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6a1b2c3d4f5"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pets",
        sa.Column(
            "avatar_status",
            sa.String(length=20),
            nullable=True,
            server_default="missing",
        ),
    )
    op.add_column(
        "pets",
        sa.Column("avatar_image_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "pets",
        sa.Column("avatar_thumb_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "pets",
        sa.Column(
            "avatar_version",
            sa.Integer(),
            nullable=True,
            server_default="0",
        ),
    )
    op.add_column(
        "pets",
        sa.Column("avatar_error", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "pets",
        sa.Column("avatar_updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        """
        UPDATE pets
        SET avatar_status = COALESCE(avatar_status, 'missing'),
            avatar_version = COALESCE(avatar_version, 0)
        """
    )

    op.alter_column("pets", "avatar_status", nullable=False)
    op.alter_column("pets", "avatar_version", nullable=False)
    op.create_check_constraint(
        "check_pet_avatar_status",
        "pets",
        "avatar_status IN ('missing', 'pending', 'ready', 'failed')",
    )
    op.alter_column("pets", "avatar_status", server_default=None)
    op.alter_column("pets", "avatar_version", server_default=None)


def downgrade() -> None:
    op.drop_constraint("check_pet_avatar_status", "pets", type_="check")
    op.drop_column("pets", "avatar_updated_at")
    op.drop_column("pets", "avatar_error")
    op.drop_column("pets", "avatar_version")
    op.drop_column("pets", "avatar_thumb_url")
    op.drop_column("pets", "avatar_image_url")
    op.drop_column("pets", "avatar_status")
