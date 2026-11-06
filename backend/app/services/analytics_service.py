"""Shopper visit counting and staff presence.

Visits: the storefront pings POST /api/analytics/ping with an anonymous
browser-generated visitor id on each page view and once a minute while the
tab is visible. A ping within 30 minutes of the visitor's last one extends
that visit; otherwise it starts a new visit. Counts are reported in Kenyan
time (EAT) for today, this week (Mon-Sun), this month, this year and all
time: visits, unique visitors and page views. Bots (by user agent) and admin
pages are never counted.

Staff presence: User.last_seen_at, refreshed on authenticated admin requests
(at most once a minute) -- "active now" = seen in the last 5 minutes.
"""
import re
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urlparse

from sqlalchemy import func

from app.extensions import db
from app.models.site_visit import SiteVisit

EAT = timezone(timedelta(hours=3))
VISIT_TIMEOUT = timedelta(minutes=30)
ACTIVE_WINDOW = timedelta(minutes=5)
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_BOT_RE = re.compile(r"bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|go-http", re.I)


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def is_bot(user_agent):
    return not user_agent or bool(_BOT_RE.search(user_agent))


def _device(user_agent):
    ua = user_agent or ""
    if re.search(r"ipad|tablet", ua, re.I):
        return "tablet"
    if re.search(r"mobi|android|iphone", ua, re.I):
        return "mobile"
    return "desktop"


def _referrer_host(referrer, own_host):
    try:
        host = (urlparse(referrer or "").hostname or "").lower()
    except ValueError:
        return None
    if not host or host == own_host or host.endswith("." + own_host):
        return None
    return host[:120]


def record_ping(visitor_id, path, new_page, user_agent, referrer=None, own_host="dermarra.com"):
    """Returns "new" | "extended" | "ignored"."""
    if not visitor_id or not UUID_RE.match(visitor_id) or is_bot(user_agent):
        return "ignored"
    path = (path or "/")[:255]
    if path.startswith("/admin"):
        return "ignored"
    now = _now()
    visit = (
        SiteVisit.query.filter(SiteVisit.visitor_id == visitor_id, SiteVisit.last_seen_at >= now - VISIT_TIMEOUT)
        .order_by(SiteVisit.last_seen_at.desc())
        .first()
    )
    if visit:
        visit.last_seen_at = now
        if new_page:
            visit.pageviews = (visit.pageviews or 0) + 1
        db.session.commit()
        return "extended"
    db.session.add(
        SiteVisit(
            visitor_id=visitor_id,
            started_at=now,
            last_seen_at=now,
            pageviews=1,
            landing_path=path,
            referrer_host=_referrer_host(referrer, own_host),
            device=_device(user_agent),
        )
    )
    db.session.commit()
    return "new"


def _utc(dt_eat):
    return dt_eat.astimezone(timezone.utc).replace(tzinfo=None)


def _period_starts(today):
    """Naive-UTC start of each period, in Kenyan time."""
    week_start = today - timedelta(days=today.weekday())  # Monday
    return {
        "today": _utc(datetime.combine(today, time.min, tzinfo=EAT)),
        "week": _utc(datetime.combine(week_start, time.min, tzinfo=EAT)),
        "month": _utc(datetime.combine(today.replace(day=1), time.min, tzinfo=EAT)),
        "year": _utc(datetime.combine(date(today.year, 1, 1), time.min, tzinfo=EAT)),
        "all": None,
    }


def _counts(since):
    q = db.session.query(
        func.count(SiteVisit.id),
        func.count(func.distinct(SiteVisit.visitor_id)),
        func.coalesce(func.sum(SiteVisit.pageviews), 0),
    )
    if since is not None:
        q = q.filter(SiteVisit.started_at >= since)
    visits, visitors, pageviews = q.one()
    return {"visits": int(visits), "visitors": int(visitors), "pageviews": int(pageviews)}


def visit_summary(days=30, today=None):
    today = today or datetime.now(EAT).date()
    now = _now()
    periods = {name: _counts(since) for name, since in _period_starts(today).items()}
    active_now = (
        db.session.query(func.count(func.distinct(SiteVisit.visitor_id)))
        .filter(SiteVisit.last_seen_at >= now - ACTIVE_WINDOW)
        .scalar()
    )

    # Visits per Kenyan day for the chart (bucketed in Python: small volume).
    first = today - timedelta(days=days - 1)
    since = _utc(datetime.combine(first, time.min, tzinfo=EAT))
    per_day = {first + timedelta(days=i): {"visits": 0, "visitors": set()} for i in range(days)}
    rows = db.session.query(SiteVisit.started_at, SiteVisit.visitor_id).filter(SiteVisit.started_at >= since)
    for started, vid in rows:
        d = started.replace(tzinfo=timezone.utc).astimezone(EAT).date()
        if d in per_day:
            per_day[d]["visits"] += 1
            per_day[d]["visitors"].add(vid)
    daily = [
        {"date": d.isoformat(), "visits": v["visits"], "visitors": len(v["visitors"])} for d, v in per_day.items()
    ]

    top_sources = (
        db.session.query(SiteVisit.referrer_host, func.count(SiteVisit.id))
        .filter(SiteVisit.started_at >= periods_start(today, "month"), SiteVisit.referrer_host.isnot(None))
        .group_by(SiteVisit.referrer_host)
        .order_by(func.count(SiteVisit.id).desc())
        .limit(5)
        .all()
    )
    devices = dict(
        db.session.query(SiteVisit.device, func.count(SiteVisit.id))
        .filter(SiteVisit.started_at >= periods_start(today, "month"))
        .group_by(SiteVisit.device)
        .all()
    )
    return {
        "timezone": "Africa/Nairobi (EAT)",
        "active_now": int(active_now or 0),
        "periods": periods,
        "daily": daily,
        "top_sources": [{"host": h, "visits": n} for h, n in top_sources],
        "devices": {k or "unknown": v for k, v in devices.items()},
    }


def periods_start(today, name):
    return _period_starts(today)[name]


# ---------------------------------------------------------------- staff presence

LAST_SEEN_THROTTLE = timedelta(seconds=60)


def touch_staff(user):
    """Refresh an admin's last_seen_at, at most once a minute."""
    now = _now()
    if user.last_seen_at and now - user.last_seen_at < LAST_SEEN_THROTTLE:
        return
    user.last_seen_at = now
    try:
        db.session.commit()
    except Exception:  # noqa: BLE001 -- presence must never break a request
        db.session.rollback()


def staff_presence(users):
    now = _now()
    out = []
    for u in users:
        seen = u.last_seen_at
        out.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "role": u.admin_role.name if u.admin_role else None,
                "last_seen_at": seen.isoformat() if seen else None,
                "active_now": bool(seen and now - seen <= ACTIVE_WINDOW),
            }
        )
    # Active first, then most recently seen; never-seen last.
    return sorted(out, key=lambda r: (not r["active_now"], r["last_seen_at"] is None, _neg(r["last_seen_at"])))


def _neg(iso):
    return -datetime.fromisoformat(iso).timestamp() if iso else 0
