import uuid
from datetime import datetime, timezone

from app.extensions import db


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SiteVisit(db.Model):
    """One shopper visit (session) on the storefront.

    Anonymous by design: `visitor_id` is a random id the browser generated
    and keeps in its own storage -- no name, account, IP address or cookie is
    stored. A visit ends after 30 minutes without a ping; the next ping
    starts a new one. See app/services/analytics_service.py."""

    __tablename__ = "site_visits"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    visitor_id = db.Column(db.String(36), nullable=False, index=True)
    started_at = db.Column(db.DateTime, nullable=False, default=_now, index=True)
    last_seen_at = db.Column(db.DateTime, nullable=False, default=_now, index=True)
    pageviews = db.Column(db.Integer, nullable=False, default=1)
    landing_path = db.Column(db.String(255))
    referrer_host = db.Column(db.String(120))
    device = db.Column(db.String(10))  # mobile | tablet | desktop
