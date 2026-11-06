"""Blog: HTML sanitising, draft/scheduled/published visibility, the
blog.manage permission, and the newsletter fixes. Disposable __TEST__ rows
on the shared dev DB, removed afterwards; Brevo is never called (stubbed)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.admin_role import AdminActivity, AdminRole
from app.models.blog import BlogPost
from app.models.user import User
from app.services import newsletter_service
from app.services.blog_service import clean_html


@pytest.fixture
def staff(app):
    made = []

    def _make(role_key):
        role = AdminRole.query.filter_by(key=role_key).first()
        u = User(email=f"__test__-{uuid.uuid4().hex[:8]}@example.com", full_name="__TEST__ writer",
                 is_admin=True, admin_role_id=role.id)
        u.set_password("not-used-123")
        db.session.add(u)
        db.session.commit()
        made.append(u.id)
        return {"Authorization": f"Bearer {create_access_token(identity=u.id)}"}

    yield _make
    db.session.rollback()
    BlogPost.query.filter(BlogPost.slug.like("test-post-%")).delete(synchronize_session=False)
    AdminActivity.query.filter(AdminActivity.actor_id.in_(made)).delete(synchronize_session=False)
    User.query.filter(User.id.in_(made)).delete(synchronize_session=False)
    db.session.commit()


def test_clean_html_strips_scripts_and_handlers():
    dirty = '<h2 onclick="x()">Hi</h2><script>alert(1)</script><p style="x">ok <a href="javascript:evil()">bad</a>' \
            ' <a href="https://dermarra.com">good</a></p><iframe src="https://x"></iframe><img src="https://i/x.jpg" onerror="y">'
    out = clean_html(dirty)
    for banned in ("script", "onclick", "onerror", "style=", "javascript:", "iframe"):
        assert banned not in out
    assert '<a href="https://dermarra.com" rel="noopener noreferrer">good</a>' in out
    assert "<h2>Hi</h2>" in out and '<img src="https://i/x.jpg">' in out


def test_draft_scheduled_published_visibility(app, staff):
    client = app.test_client()
    h = staff("marketing_content")
    slug = f"test-post-{uuid.uuid4().hex[:6]}"

    r = client.post("/api/admin/blog/posts", headers=h, json={"title": "__TEST__ post", "slug": slug,
                                                              "body_html": "<p>Hello <script>x</script></p>"})
    assert r.status_code == 201
    post = r.get_json()
    assert post["state"] == "draft" and "script" not in post["body_html"]
    assert client.get(f"/api/blog/posts/{slug}").status_code == 404  # drafts are private

    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    r = client.patch(f"/api/admin/blog/posts/{post['id']}", headers=h, json={"status": "published", "published_at": future})
    assert r.status_code == 200 and r.get_json()["state"] == "scheduled"
    assert client.get(f"/api/blog/posts/{slug}").status_code == 404  # not yet

    r = client.patch(f"/api/admin/blog/posts/{post['id']}", headers=h, json={"published_at": None})
    assert r.status_code == 200 and r.get_json()["state"] == "published"  # no date = now
    r = client.get(f"/api/blog/posts/{slug}")
    assert r.status_code == 200 and r.get_json()["body_html"] == "<p>Hello </p>"
    assert any(p["slug"] == slug for p in client.get("/api/blog/posts").get_json()["items"])

    assert client.post("/api/admin/blog/posts", headers=h, json={"title": "x", "slug": slug}).status_code == 400  # dup
    assert client.post("/api/admin/blog/posts", headers=h, json={"title": "x", "slug": "Not A Slug"}).status_code == 400


def test_blog_permission(app, staff):
    client = app.test_client()
    assert client.get("/api/admin/blog/posts", headers=staff("orders_dispatch")).status_code == 403
    assert client.get("/api/admin/blog/posts", headers=staff("store_manager")).status_code == 200


def test_newsletter_adds_existing_contacts_and_names(app, monkeypatch):
    sent = {}

    class FakeApi:
        def __init__(self, *_):
            pass

        def create_contact(self, contact):
            sent["contact"] = contact

    monkeypatch.setattr(newsletter_service.sib_api_v3_sdk, "ContactsApi", FakeApi)
    monkeypatch.setitem(app.config, "BREVO_NEWSLETTER_LIST_ID", 2)
    newsletter_service.subscribe("jane@example.com", "Jane Wanjiru Doe")
    c = sent["contact"]
    assert c.update_enabled is True and c.list_ids == [2]
    assert c.attributes == {"FIRSTNAME": "Jane", "LASTNAME": "Wanjiru Doe"}

    monkeypatch.setitem(app.config, "BREVO_NEWSLETTER_LIST_ID", None)
    with pytest.raises(newsletter_service.NewsletterNotConfigured):
        newsletter_service.subscribe("jane@example.com")
    assert newsletter_service.subscribe_quietly("jane@example.com") is False  # never raises
