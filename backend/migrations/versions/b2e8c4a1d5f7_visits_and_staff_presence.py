"""shopper visits + staff last-seen

Additive: a site_visits table and a nullable users.last_seen_at.

Revision ID: b2e8c4a1d5f7
Revises: 9d4f2b7e1c3a
Create Date: 2026-11-06
"""
import sqlalchemy as sa
from alembic import op

revision = "b2e8c4a1d5f7"
down_revision = "9d4f2b7e1c3a"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "site_visits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("visitor_id", sa.String(36), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.Column("pageviews", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("landing_path", sa.String(255)),
        sa.Column("referrer_host", sa.String(120)),
        sa.Column("device", sa.String(10)),
    )
    op.create_index("ix_site_visits_visitor_id", "site_visits", ["visitor_id"])
    op.create_index("ix_site_visits_started_at", "site_visits", ["started_at"])
    op.create_index("ix_site_visits_last_seen_at", "site_visits", ["last_seen_at"])
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("users", "last_seen_at")
    op.drop_index("ix_site_visits_last_seen_at", table_name="site_visits")
    op.drop_index("ix_site_visits_started_at", table_name="site_visits")
    op.drop_index("ix_site_visits_visitor_id", table_name="site_visits")
    op.drop_table("site_visits")
