"""blog posts and categories; blog.manage permission

Additive. Seeds three starter categories (editable) and grants the new
blog.manage permission to the Store manager and Marketing & content roles
(Super admin has every permission already).

Revision ID: 9d4f2b7e1c3a
Revises: 7b1e4c9d2a60
Create Date: 2026-11-06
"""
import json
import uuid

import sqlalchemy as sa
from alembic import op

revision = "9d4f2b7e1c3a"
down_revision = "7b1e4c9d2a60"
branch_labels = None
depends_on = None

CATEGORIES = [
    ("Ingredients 101", "ingredients-101", "What each active does, and how to use it."),
    ("Routines", "routines", "Building a routine that works, step by step."),
    ("Skin concerns", "skin-concerns", "Understanding and treating common skin concerns."),
]


def upgrade():
    op.create_table(
        "blog_categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(140), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "blog_posts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(220), nullable=False, unique=True),
        sa.Column("excerpt", sa.String(400)),
        sa.Column("body_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover_public_id", sa.String(255)),
        sa.Column("category_id", sa.String(36), sa.ForeignKey("blog_categories.id", ondelete="SET NULL")),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("author_name", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime()),
        sa.Column("seo_description", sa.String(300)),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_index("ix_blog_posts_slug", "blog_posts", ["slug"])
    op.create_index("ix_blog_posts_category_id", "blog_posts", ["category_id"])
    op.create_index("ix_blog_posts_published_at", "blog_posts", ["published_at"])

    cats = sa.table(
        "blog_categories",
        sa.column("id", sa.String), sa.column("name", sa.String), sa.column("slug", sa.String),
        sa.column("description", sa.Text), sa.column("position", sa.Integer),
    )
    op.bulk_insert(
        cats,
        [
            {"id": str(uuid.uuid4()), "name": n, "slug": s, "description": d, "position": i}
            for i, (n, s, d) in enumerate(CATEGORIES)
        ],
    )

    conn = op.get_bind()
    for key in ("store_manager", "marketing_content"):
        row = conn.execute(sa.text("SELECT id, permissions FROM admin_roles WHERE key = :k"), {"k": key}).first()
        if not row:
            continue
        perms = row.permissions if isinstance(row.permissions, list) else json.loads(row.permissions or "[]")
        if "blog.manage" not in perms:
            perms.append("blog.manage")
            conn.execute(
                sa.text("UPDATE admin_roles SET permissions = CAST(:p AS json) WHERE id = :id"),
                {"p": json.dumps(perms), "id": row.id},
            )


def downgrade():
    op.drop_index("ix_blog_posts_published_at", table_name="blog_posts")
    op.drop_index("ix_blog_posts_category_id", table_name="blog_posts")
    op.drop_index("ix_blog_posts_slug", table_name="blog_posts")
    op.drop_table("blog_posts")
    op.drop_table("blog_categories")
