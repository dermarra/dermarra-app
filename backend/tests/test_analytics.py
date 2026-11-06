"""Shopper visit counting and staff presence. Disposable rows on the shared
dev DB (test visitor ids, __TEST__ users), removed afterwards."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.admin_role import AdminActivity, AdminRole
from app.models.site_visit import SiteVisit
from app.models.user import User
from app.services import analytics_service

BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"


@pytest.fixture
def visitors(app):
    ids = []

    def _new():
        v = str(uuid.uuid4())
        ids.append(v)
        return v

    yield _new
    db.session.rollback()
    SiteVisit.query.filter(SiteVisit.visitor_id.in_(ids)).delete(synchronize_session=False)
    db.session.commit()


def test_visit_lifecycle_and_filters(app, visitors):
    v = visitors()
    assert analytics_service.record_ping(v, "/blog", True, BROWSER, "https://www.instagram.com/x") == "new"
    assert analytics_service.record_ping(v, "/shop", True, BROWSER) == "extended"
    assert analytics_service.record_ping(v, "/shop", False, BROWSER) == "extended"  # heartbeat: no new page
    visit = SiteVisit.query.filter_by(visitor_id=v).one()
    assert visit.pageviews == 2 and visit.landing_path == "/blog"
    assert visit.referrer_host == "www.instagram.com" and visit.device == "mobile"

    # 30 minutes idle -> the next ping is a new visit.
    visit.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=31)
    db.session.commit()
    assert analytics_service.record_ping(v, "/", True, BROWSER) == "new"
    assert SiteVisit.query.filter_by(visitor_id=v).count() == 2

    # Never counted: bots, admin pages, malformed ids.
    assert analytics_service.record_ping(visitors(), "/", True, "Googlebot/2.1") == "ignored"
    assert analytics_service.record_ping(visitors(), "/admin/orders", True, BROWSER) == "ignored"
    assert analytics_service.record_ping("not-a-uuid", "/", True, BROWSER) == "ignored"


def test_summary_counts_periods(app, visitors):
    before = analytics_service.visit_summary(days=7)
    a, b = visitors(), visitors()
    analytics_service.record_ping(a, "/", True, BROWSER)
    analytics_service.record_ping(a, "/shop", True, BROWSER)
    analytics_service.record_ping(b, "/", True, BROWSER)
    after = analytics_service.visit_summary(days=7)
    for period in ("today", "week", "month", "year", "all"):
        assert after["periods"][period]["visits"] - before["periods"][period]["visits"] == 2
        assert after["periods"][period]["visitors"] - before["periods"][period]["visitors"] == 2
        assert after["periods"][period]["pageviews"] - before["periods"][period]["pageviews"] == 3
    assert after["active_now"] - before["active_now"] == 2
    assert len(after["daily"]) == 7 and after["daily"][-1]["visits"] >= 2


def test_ping_endpoint_and_admin_views(app, visitors):
    client = app.test_client()
    v = visitors()
    r = client.post("/api/analytics/ping", json={"visitor_id": v, "path": "/", "new_page": True}, headers={"User-Agent": BROWSER})
    assert r.status_code == 204 and SiteVisit.query.filter_by(visitor_id=v).count() == 1
    assert client.post("/api/analytics/ping", json={}, headers={"User-Agent": BROWSER}).status_code == 204  # quietly ignored

    role = AdminRole.query.filter_by(key="orders_dispatch").first()
    staff = User(email=f"__test__-{uuid.uuid4().hex[:8]}@example.com", full_name="__TEST__ staff", is_admin=True, admin_role_id=role.id)
    staff.set_password("not-used-123")
    db.session.add(staff)
    db.session.commit()
    try:
        h = {"Authorization": f"Bearer {create_access_token(identity=staff.id)}"}
        r = client.get("/api/admin/analytics/visits", headers=h)
        assert r.status_code == 200 and set(r.get_json()["periods"]) == {"today", "week", "month", "year", "all"}
        r = client.get("/api/admin/presence", headers=h)  # this request itself marks them active
        me = next(p for p in r.get_json() if p["id"] == staff.id)
        assert me["active_now"] is True and me["role"] == "Orders & dispatch"
        assert client.get("/api/admin/presence").status_code == 401
    finally:
        AdminActivity.query.filter_by(actor_id=staff.id).delete()
        db.session.delete(staff)
        db.session.commit()
