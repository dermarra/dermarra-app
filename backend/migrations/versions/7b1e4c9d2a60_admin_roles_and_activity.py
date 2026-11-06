"""admin roles, permissions and activity log

Additive only (new tables + a nullable users.admin_role_id), so code that
predates it keeps working while a deploy catches up.

Seeds the five preset roles from app/utils/permissions.py and gives every
existing admin a role: the owner (stevekamnjoros@gmail.com) super admin,
everyone else who was an admin store manager (owner's decision, 2026-11-06).

Revision ID: 7b1e4c9d2a60
Revises: 3c8e1f2a9b7d
Create Date: 2026-11-06
"""
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "7b1e4c9d2a60"
down_revision = "3c8e1f2a9b7d"
branch_labels = None
depends_on = None

OWNER_EMAIL = "stevekamnjoros@gmail.com"


def upgrade():
    from app.utils.permissions import PRESET_ROLES

    op.create_table(
        "admin_roles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(60), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("is_super", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_table(
        "admin_activity",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("actor_name", sa.String(255)),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("summary", sa.String(255), nullable=False),
        sa.Column("target_type", sa.String(40)),
        sa.Column("target_id", sa.String(120)),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("details", sa.JSON()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_admin_activity_actor_id", "admin_activity", ["actor_id"])
    op.create_index("ix_admin_activity_action", "admin_activity", ["action"])
    op.create_index("ix_admin_activity_created_at", "admin_activity", ["created_at"])

    op.add_column("users", sa.Column("admin_role_id", sa.String(36), nullable=True))
    op.create_foreign_key("fk_users_admin_role_id", "users", "admin_roles", ["admin_role_id"], ["id"])
    op.create_index("ix_users_admin_role_id", "users", ["admin_role_id"])

    roles = sa.table(
        "admin_roles",
        sa.column("id", sa.String),
        sa.column("key", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("permissions", sa.JSON),
        sa.column("is_super", sa.Boolean),
        sa.column("created_at", sa.DateTime),
    )
    ids = {key: str(uuid.uuid4()) for key in PRESET_ROLES}
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    op.bulk_insert(
        roles,
        [
            {
                "id": ids[key],
                "key": key,
                "name": r["name"],
                "description": r["description"],
                "permissions": r["permissions"],
                "is_super": r.get("is_super", False),
                "created_at": now,
            }
            for key, r in PRESET_ROLES.items()
        ],
    )

    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE users SET admin_role_id = :rid WHERE is_admin AND lower(email) = :owner"),
        {"rid": ids["super_admin"], "owner": OWNER_EMAIL},
    )
    conn.execute(
        sa.text("UPDATE users SET admin_role_id = :rid WHERE is_admin AND admin_role_id IS NULL"),
        {"rid": ids["store_manager"]},
    )


def downgrade():
    op.drop_index("ix_users_admin_role_id", table_name="users")
    op.drop_constraint("fk_users_admin_role_id", "users", type_="foreignkey")
    op.drop_column("users", "admin_role_id")
    op.drop_index("ix_admin_activity_created_at", table_name="admin_activity")
    op.drop_index("ix_admin_activity_action", table_name="admin_activity")
    op.drop_index("ix_admin_activity_actor_id", table_name="admin_activity")
    op.drop_table("admin_activity")
    op.drop_table("admin_roles")
