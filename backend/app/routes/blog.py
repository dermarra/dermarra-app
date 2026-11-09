"""Blog: public reading API (/api/blog/*) and admin authoring
(/api/admin/blog/*, permission blog.manage -- registered on admin_bp so the
activity log records changes).

A post is public when status == "published" and published_at <= now; a
future published_at is a scheduled post."""
import re
import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models.blog import BlogCategory, BlogPost
from app.routes.admin import _delete_image_quietly, admin_bp
from app.services.blog_service import clean_html
from app.utils.decorators import permission_required

blog_bp = Blueprint("blog", __name__)

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _live():
    return BlogPost.query.filter(BlogPost.status == "published", BlogPost.published_at <= _now())


# ---------------------------------------------------------------- public


@blog_bp.get("/posts")
def list_posts():
    q = _live()
    cat = request.args.get("category")
    if cat:
        q = q.join(BlogCategory).filter(BlogCategory.slug == cat)
    try:
        page = max(1, int(request.args.get("page", 1)))
        per = max(1, min(int(request.args.get("limit", 12)), 48))
    except ValueError:
        page, per = 1, 12
    total = q.count()
    posts = q.order_by(BlogPost.published_at.desc()).offset((page - 1) * per).limit(per).all()
    pages = max(1, -(-total // per))
    return jsonify({"items": [p.to_dict() for p in posts], "total": total, "page": page, "pages": pages}), 200


@blog_bp.get("/posts/<slug>")
def get_post(slug):
    post = _live().filter(BlogPost.slug == slug).first_or_404()
    related_q = _live().filter(BlogPost.id != post.id)
    related = []
    if post.category_id:
        related = (
            related_q.filter(BlogPost.category_id == post.category_id)
            .order_by(BlogPost.published_at.desc())
            .limit(3)
            .all()
        )
    if len(related) < 3:
        have = {p.id for p in related}
        more = (
            related_q.filter(~BlogPost.id.in_(have or {""}))
            .order_by(BlogPost.published_at.desc())
            .limit(3 - len(related))
            .all()
        )
        related += more
    data = post.to_dict(include_body=True)
    data["related"] = [p.to_dict() for p in related]
    return jsonify(data), 200


@blog_bp.get("/categories")
def list_categories():
    counts = dict(
        db.session.query(BlogPost.category_id, func.count(BlogPost.id))
        .filter(BlogPost.status == "published", BlogPost.published_at <= _now())
        .group_by(BlogPost.category_id)
        .all()
    )
    cats = BlogCategory.query.order_by(BlogCategory.position, BlogCategory.name).all()
    return jsonify([c.to_dict(post_count=counts.get(c.id, 0)) for c in cats]), 200


# ---------------------------------------------------------------- admin


def _parse_when(value):
    """ISO date-time from the editor (with or without offset) -> naive UTC."""
    if not value:
        return None
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _apply_post(post, data):
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return "a post needs a title"
        post.title = title[:200]
    if "slug" in data:
        slug = (data.get("slug") or "").strip()
        if not _SLUG_RE.match(slug):
            return "the page address must be lowercase words joined by hyphens, e.g. vitamin-c-guide"
        clash = BlogPost.query.filter(BlogPost.slug == slug, BlogPost.id != post.id).first()
        if clash:
            return f"another post already uses /blog/{slug}"
        post.slug = slug
    if "excerpt" in data:
        post.excerpt = (data.get("excerpt") or "").strip()[:400] or None
    if "body_html" in data:
        post.body_html = clean_html(data.get("body_html"))
    if "cover_public_id" in data:
        post.cover_public_id = data.get("cover_public_id") or None
    if "category_id" in data:
        cid = data.get("category_id") or None
        if cid and not BlogCategory.query.get(cid):
            return "that category doesn't exist"
        post.category_id = cid
    if "seo_description" in data:
        post.seo_description = (data.get("seo_description") or "").strip()[:300] or None
    if "status" in data:
        status = data.get("status")
        if status not in ("draft", "published"):
            return "status must be draft or published"
        post.status = status
    if "published_at" in data:
        try:
            post.published_at = _parse_when(data.get("published_at"))
        except ValueError:
            return "the publish date isn't a valid date and time"
    if post.status == "published" and not post.published_at:
        post.published_at = _now()
    if post.status == "published" and not (post.body_html or "").strip():
        return "write something in the post before publishing it"
    return None


@admin_bp.get("/blog/posts")
@permission_required("blog.manage")
def admin_list_posts():
    posts = BlogPost.query.order_by(BlogPost.updated_at.desc()).all()
    return jsonify([p.to_dict() for p in posts]), 200


@admin_bp.get("/blog/posts/<post_id>")
@permission_required("blog.manage")
def admin_get_post(post_id):
    return jsonify(BlogPost.query.get_or_404(post_id).to_dict(include_body=True)), 200


@admin_bp.post("/blog/posts")
@permission_required("blog.manage")
def create_blog_post():
    data = request.get_json(silent=True) or {}
    post = BlogPost(
        id=str(uuid.uuid4()),
        status="draft",
        body_html="",
        author_id=g.admin_user.id,
        author_name=g.admin_user.full_name,
    )
    err = _apply_post(post, {"title": data.get("title"), "slug": data.get("slug"), **data})
    if err:
        return jsonify({"error": err}), 400
    db.session.add(post)
    g.activity_summary = f"Added the blog post “{post.title}”"
    db.session.commit()
    return jsonify(post.to_dict(include_body=True)), 201


@admin_bp.patch("/blog/posts/<post_id>")
@permission_required("blog.manage")
def update_blog_post(post_id):
    post = BlogPost.query.get_or_404(post_id)
    was_live = post.state == "published"
    err = _apply_post(post, request.get_json(silent=True) or {})
    if err:
        db.session.rollback()
        return jsonify({"error": err}), 400
    now_state = post.state
    g.activity_summary = (
        f"Published “{post.title}”" if now_state == "published" and not was_live
        else f"Scheduled “{post.title}”" if now_state == "scheduled"
        else f"Edited the blog post “{post.title}”"
    )
    db.session.commit()
    return jsonify(post.to_dict(include_body=True)), 200


@admin_bp.delete("/blog/posts/<post_id>")
@permission_required("blog.manage")
def delete_blog_post(post_id):
    post = BlogPost.query.get_or_404(post_id)
    cover = post.cover_public_id
    g.activity_summary = f"Deleted the blog post “{post.title}”"
    db.session.delete(post)
    db.session.commit()
    _delete_image_quietly(cover)
    return "", 204


def _apply_category(cat, data):
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return "a category needs a name"
        cat.name = name[:120]
    if "slug" in data:
        slug = (data.get("slug") or "").strip()
        if not _SLUG_RE.match(slug):
            return "the address must be lowercase words joined by hyphens, e.g. ingredients-101"
        if BlogCategory.query.filter(BlogCategory.slug == slug, BlogCategory.id != cat.id).first():
            return "another category already uses that address"
        cat.slug = slug
    if "description" in data:
        cat.description = (data.get("description") or "").strip() or None
    if "position" in data:
        try:
            cat.position = int(data.get("position") or 0)
        except (TypeError, ValueError):
            return "position must be a whole number"
    return None


@admin_bp.get("/blog/categories")
@permission_required("blog.manage")
def admin_list_categories():
    counts = dict(
        db.session.query(BlogPost.category_id, func.count(BlogPost.id)).group_by(BlogPost.category_id).all()
    )
    cats = BlogCategory.query.order_by(BlogCategory.position, BlogCategory.name).all()
    return jsonify([c.to_dict(post_count=counts.get(c.id, 0)) for c in cats]), 200


@admin_bp.post("/blog/categories")
@permission_required("blog.manage")
def create_blog_category():
    data = request.get_json(silent=True) or {}
    cat = BlogCategory(id=str(uuid.uuid4()), position=0)
    err = _apply_category(cat, {"name": data.get("name"), "slug": data.get("slug"), **data})
    if err:
        return jsonify({"error": err}), 400
    db.session.add(cat)
    g.activity_summary = f"Added the blog category {cat.name}"
    db.session.commit()
    return jsonify(cat.to_dict(post_count=0)), 201


@admin_bp.patch("/blog/categories/<category_id>")
@permission_required("blog.manage")
def update_blog_category(category_id):
    cat = BlogCategory.query.get_or_404(category_id)
    err = _apply_category(cat, request.get_json(silent=True) or {})
    if err:
        db.session.rollback()
        return jsonify({"error": err}), 400
    g.activity_summary = f"Edited the blog category {cat.name}"
    db.session.commit()
    return jsonify(cat.to_dict()), 200


@admin_bp.delete("/blog/categories/<category_id>")
@permission_required("blog.manage")
def delete_blog_category(category_id):
    cat = BlogCategory.query.get_or_404(category_id)
    used = BlogPost.query.filter_by(category_id=cat.id).count()
    if used:
        who = "1 post uses" if used == 1 else f"{used} posts use"
        return jsonify({"error": f"{who} this category. Move them first"}), 400
    g.activity_summary = f"Deleted the blog category {cat.name}"
    db.session.delete(cat)
    db.session.commit()
    return "", 204
