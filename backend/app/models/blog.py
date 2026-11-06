import math
import re
import uuid
from datetime import datetime, timezone

from app.extensions import db


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class BlogCategory(db.Model):
    """Admin-managed blog categories (e.g. Ingredients 101, Routines)."""

    __tablename__ = "blog_categories"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(140), unique=True, nullable=False)
    description = db.Column(db.Text)
    position = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self, post_count=None):
        data = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "position": self.position,
        }
        if post_count is not None:
            data["post_count"] = post_count
        return data


class BlogPost(db.Model):
    """A blog post. Live when status == "published" and published_at <= now,
    so a future published_at is a scheduled post (no job needed: public
    queries just filter on the clock). body_html is sanitised on save
    (app/services/blog_service.py) -- render it as-is."""

    __tablename__ = "blog_posts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(220), unique=True, nullable=False, index=True)
    excerpt = db.Column(db.String(400))
    body_html = db.Column(db.Text, nullable=False, default="")
    cover_public_id = db.Column(db.String(255))
    category_id = db.Column(db.String(36), db.ForeignKey("blog_categories.id", ondelete="SET NULL"), index=True)
    author_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"))
    author_name = db.Column(db.String(255))  # snapshot shown as the byline
    status = db.Column(db.String(20), nullable=False, default="draft")  # draft | published
    published_at = db.Column(db.DateTime, index=True)
    seo_description = db.Column(db.String(300))
    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    category = db.relationship("BlogCategory", lazy="joined")

    @property
    def state(self):
        """draft | scheduled | published -- what the admin list shows."""
        if self.status != "published" or not self.published_at:
            return "draft"
        return "scheduled" if self.published_at > _now() else "published"

    @property
    def reading_minutes(self):
        words = len(re.sub(r"<[^>]+>", " ", self.body_html or "").split())
        return max(1, math.ceil(words / 220))

    def to_dict(self, include_body=False):
        data = {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "excerpt": self.excerpt,
            "cover_public_id": self.cover_public_id,
            "category": self.category.to_dict() if self.category else None,
            "author_name": self.author_name,
            "status": self.status,
            "state": self.state,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "reading_minutes": self.reading_minutes,
            "seo_description": self.seo_description,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_body:
            data["body_html"] = self.body_html
        return data
