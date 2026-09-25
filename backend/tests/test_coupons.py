"""Coupon lifecycle coverage: eligibility rules, pricing, and the two-phase
used_count (apply at checkout, release on cancel) -- see coupon_service.py
and the Coupon model docstring for why it mirrors inventory_service.py's
reserve -> consume/release pattern.

See tests/conftest.py for why these hit the real dev DB instead of a
sqlite/transactional test DB.
"""
import threading
import time
from datetime import datetime, timedelta, timezone

from app.extensions import db
from app.models.coupon import Coupon
from app.services import coupon_service
from app.services.coupon_service import CouponError


# ---------- Pricing ----------

def test_percent_discount_computed_off_subtotal(app, make_coupon, test_user):
    coupon = make_coupon(discount_type="percent", discount_value=20)
    _, discount = coupon_service.validate_and_price(coupon.code, test_user, 10000)
    assert discount == 2000


def test_fixed_discount_clamped_to_subtotal(app, make_coupon, test_user):
    """A KES 50 (5000 cents) off coupon on a KES 30 (3000 cents) cart must
    never make the total negative."""
    coupon = make_coupon(discount_type="fixed_cents", discount_value=5000)
    _, discount = coupon_service.validate_and_price(coupon.code, test_user, 3000)
    assert discount == 3000


# ---------- Eligibility ----------

def test_rejects_inactive_coupon(app, make_coupon, test_user):
    coupon = make_coupon(is_active=False)
    try:
        coupon_service.validate_and_price(coupon.code, test_user, 10000)
        assert False, "expected a CouponError"
    except CouponError:
        pass


def test_rejects_expired_coupon(app, make_coupon, test_user):
    coupon = make_coupon(expires_at=datetime.now(timezone.utc) - timedelta(days=1))
    try:
        coupon_service.validate_and_price(coupon.code, test_user, 10000)
        assert False, "expected a CouponError"
    except CouponError:
        pass


def test_rejects_when_max_uses_reached(app, make_coupon, test_user):
    coupon = make_coupon(max_uses=1, used_count=1)
    try:
        coupon_service.validate_and_price(coupon.code, test_user, 10000)
        assert False, "expected a CouponError"
    except CouponError:
        pass


def test_first_order_only_rejects_user_with_a_prior_paid_order(app, make_coupon, make_variant, make_order, test_user):
    coupon = make_coupon(first_order_only=True)
    variant = make_variant(name="__TEST__ coupon-prior-order")
    prior_order = make_order(variant)
    prior_order.status = "paid"
    db.session.commit()

    try:
        coupon_service.validate_and_price(coupon.code, test_user, 10000)
        assert False, "expected a CouponError"
    except CouponError:
        pass


# ---------- Two-phase used_count: apply at checkout, release on cancel ----------

def test_apply_usage_increments_and_release_usage_decrements(app, make_coupon, make_variant, make_order):
    """Simulates the full checkout -> cancel lifecycle: a coupon's
    used_count goes up when an order that used it is created, and back
    down if that order is later cancelled -- covers both the customer
    cancel-before-payment path (orders.py) and the admin cancel-a-paid-
    order path (admin.py), since both call this exact same function."""
    coupon = make_coupon()
    variant = make_variant(name="__TEST__ coupon-lifecycle")
    order = make_order(variant)
    order.coupon_id = coupon.id
    order.coupon_code_snapshot = coupon.code
    db.session.commit()

    coupon_service.apply_usage(coupon)
    db.session.commit()
    assert Coupon.query.get(coupon.id).used_count == 1

    coupon_service.release_usage(order)
    db.session.commit()
    assert Coupon.query.get(coupon.id).used_count == 0


def test_release_usage_is_a_noop_for_an_order_with_no_coupon(app, make_variant, make_order):
    variant = make_variant(name="__TEST__ coupon-noop-release")
    order = make_order(variant)
    db.session.commit()
    coupon_service.release_usage(order)  # must not raise
    db.session.commit()


# ---------- Concurrency: max_uses under a race ----------

def test_max_uses_concurrency_never_double_books_the_last_use(app, make_coupon):
    """Two 'customers' race to spend the last use of a max_uses=1 coupon.
    The second apply_usage must block on the first's row lock (proven by
    timing it), and must fail once it does proceed -- used_count must
    never exceed max_uses. Same style as
    test_reservation_concurrency_last_unit_never_double_books in
    test_inventory.py."""
    coupon = make_coupon(max_uses=1)
    coupon_id = coupon.id

    results = {}
    b_may_start = threading.Event()

    def run_a():
        with app.app_context():
            c = Coupon.query.get(coupon_id)
            coupon_service.apply_usage(c)
            # Hold the row lock open (uncommitted) so B's FOR UPDATE has
            # something real to block on, not just a timing coincidence.
            b_may_start.set()
            time.sleep(1.0)
            db.session.commit()
            results["a"] = "ok"

    def run_b():
        with app.app_context():
            b_may_start.wait(timeout=5)
            start = time.monotonic()
            c = Coupon.query.get(coupon_id)
            try:
                coupon_service.apply_usage(c)
                db.session.commit()
                results["b"] = "ok"
            except CouponError:
                db.session.rollback()
                results["b"] = "exhausted"
            results["b_waited"] = time.monotonic() - start

    t_a = threading.Thread(target=run_a)
    t_b = threading.Thread(target=run_b)
    t_a.start()
    t_b.start()
    t_a.join(timeout=10)
    t_b.join(timeout=10)

    assert results.get("a") == "ok"
    assert results.get("b") == "exhausted"
    assert results["b_waited"] >= 0.9, "B did not appear to block on A's row lock"

    # The main thread's session has been open since make_coupon() above,
    # across the whole test -- even a fresh .filter_by().first() query on
    # it can still return what A/B's *separate* sessions committed as
    # stale, without an explicit expire_all() forcing this session to
    # actually see their commits. Confirmed by direct repro: identical
    # query returns used_count=0 without this line, =1 with it.
    db.session.expire_all()
    assert Coupon.query.filter_by(id=coupon_id).first().used_count == 1
