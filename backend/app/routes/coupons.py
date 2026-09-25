from datetime import datetime, timezone

from flask import Blueprint, jsonify

from app.models.coupon import Coupon

coupons_bp = Blueprint("coupons", __name__)


@coupons_bp.get("/featured")
def featured_coupon():
    """The most-recently-created active, unexpired, first-order-only
    coupon -- what the homepage's "Become a member" section reads to
    decide whether (and what) to advertise. Returns null rather than 404
    if none is configured, same defensive "never assume content exists"
    pattern as GET /api/hero-slides."""
    now = datetime.now(timezone.utc)
    coupon = (
        Coupon.query.filter_by(is_active=True, first_order_only=True)
        .filter((Coupon.expires_at.is_(None)) | (Coupon.expires_at > now))
        .filter((Coupon.max_uses.is_(None)) | (Coupon.used_count < Coupon.max_uses))
        .order_by(Coupon.created_at.desc())
        .first()
    )
    return jsonify(coupon.to_dict() if coupon else None), 200
