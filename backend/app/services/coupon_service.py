"""Coupon validation, pricing, and usage-counting -- see Coupon model
docstring for the two-phase used_count rationale (mirrors
inventory_service.py's reserve -> consume/release pattern).

Every function here assumes it's called inside an existing db.session
transaction and leaves the commit to the caller (matches inventory_service.py
and the rest of this codebase's route-owns-the-commit convention).
"""
from datetime import datetime, timezone

from app.models.coupon import Coupon
from app.models.order import Order

_PAID_STATUSES = ("paid", "processing", "shipped", "delivered")


class CouponError(ValueError):
    """Raised for an invalid/expired/exhausted/ineligible code -- a 400,
    not a 5xx."""


def validate_and_price(code, user, subtotal_cents):
    """Looks up `code`, checks every eligibility rule, and returns
    (coupon, discount_cents). Does NOT touch used_count -- call apply_usage
    separately, at the point a coupon is actually spent (checkout), not
    every time it's previewed (cart apply-coupon)."""
    if not code:
        raise CouponError("code is required")

    coupon = Coupon.query.filter_by(code=code.strip().upper()).first()
    if not coupon or not coupon.is_active:
        raise CouponError("this code isn't valid")
    # `expires_at` comes back from Postgres as a naive datetime (the column
    # is TIMESTAMP WITHOUT TIME ZONE, like every other DateTime column in
    # this codebase) -- compare against a naive UTC "now", not an
    # aware one, or this raises TypeError instead of ever returning False.
    if coupon.expires_at and coupon.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise CouponError("this code has expired")
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        raise CouponError("this code has already been used the maximum number of times")
    if coupon.first_order_only:
        has_prior_order = (
            Order.query.filter_by(user_id=user.id)
            .filter(Order.status.in_(_PAID_STATUSES))
            .first()
            is not None
        )
        if has_prior_order:
            raise CouponError("this code is only valid on your first order")

    if coupon.discount_type == "percent":
        discount_cents = round(subtotal_cents * coupon.discount_value / 100)
    else:
        discount_cents = coupon.discount_value
    discount_cents = min(discount_cents, subtotal_cents)

    return coupon, discount_cents


def apply_usage(coupon):
    """Locks the coupon row and increments used_count -- call once, at the
    point a coupon is actually spent (order creation), never at preview
    time. Re-checks max_uses under the lock so two concurrent checkouts
    racing for the last use of a nearly-exhausted coupon can't both
    succeed."""
    locked = Coupon.query.filter_by(id=coupon.id).with_for_update().first()
    if locked.max_uses is not None and locked.used_count >= locked.max_uses:
        raise CouponError("this code has already been used the maximum number of times")
    locked.used_count += 1
    return locked


def release_usage(order):
    """Reverses apply_usage for an order that's cancelled before ever
    completing, or an already-paid order an admin cancels (mirrors
    inventory_service.py's release_reservations_for_order/restock_order
    symmetry). No-op if the order never actually used a coupon."""
    if not order.coupon_id:
        return
    locked = Coupon.query.filter_by(id=order.coupon_id).with_for_update().first()
    if locked:
        locked.used_count = max(0, locked.used_count - 1)
