"""Dashboard figures and the 24-hour abandoned-order rule.

Assertions compare the dashboard before vs after the test creates its own
orders (deltas), so they hold regardless of whatever else is in the shared
dev DB (see conftest.py).
"""
from datetime import datetime, timedelta, timezone

from app.extensions import db
from app.models.inventory import Inventory, InventoryReservation
from app.models.order import Order
from app.services import dashboard_service, inventory_service, payment_service


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _stocked(make_variant, stock=10):
    variant = make_variant(name="__TEST__ dashboard")
    inventory_service.record_production_run(variant.id, batch_number="B1", quantity_produced=stock)
    db.session.commit()
    return variant


# ---------- 24h abandoned orders ----------

def test_abandoned_unpaid_order_is_closed_after_24h(app, make_variant, make_order):
    variant = _stocked(make_variant)
    old = make_order(variant, quantity=2)
    inventory_service.reserve_stock_for_order(old)
    old.created_at = _now() - timedelta(hours=25)
    fresh = make_order(variant, quantity=1)
    fresh.created_at = _now() - timedelta(hours=1)
    db.session.commit()

    payment_service.expire_abandoned_orders()
    db.session.commit()
    db.session.expire_all()

    closed = Order.query.get(old.id)
    assert closed.status == "cancelled"
    assert closed.payment_failure_reason == payment_service.ABANDONED_REASON
    assert InventoryReservation.query.filter_by(order_id=old.id, status="active").count() == 0
    assert Inventory.query.filter_by(variant_id=variant.id).first().reserved == 0
    assert Order.query.get(fresh.id).status == "pending", "a 1-hour-old order must be left alone"


def test_in_flight_payment_is_never_auto_closed(app, make_variant, make_order):
    """payment_pending must be confirmed with Safaricom before cancelling."""
    variant = _stocked(make_variant)
    order = make_order(variant)
    order.status = "payment_pending"
    order.created_at = _now() - timedelta(hours=30)
    db.session.commit()

    payment_service.expire_abandoned_orders()
    db.session.commit()
    db.session.expire_all()
    assert Order.query.get(order.id).status == "payment_pending"


# ---------- Dashboard ----------

def test_revenue_card_and_chart_agree_and_respect_the_period(app, make_variant, make_order):
    variant = _stocked(make_variant)
    before_7 = dashboard_service.build_dashboard("7d")
    before_30 = dashboard_service.build_dashboard("30d")

    recent = make_order(variant, quantity=1)  # paid today
    recent.status, recent.paid_at = "delivered", _now()
    older = make_order(variant, quantity=1)   # paid 10 days ago: in 30d, not 7d
    older.status, older.paid_at = "paid", _now() - timedelta(days=10)
    refunded = make_order(variant, quantity=1)  # cancelled: never revenue
    refunded.status, refunded.paid_at = "cancelled", _now()
    db.session.commit()

    after_7 = dashboard_service.build_dashboard("7d")
    after_30 = dashboard_service.build_dashboard("30d")
    price = variant.price_cents

    assert after_7["kpis"]["revenue_cents"] - before_7["kpis"]["revenue_cents"] == price
    assert after_30["kpis"]["revenue_cents"] - before_30["kpis"]["revenue_cents"] == 2 * price
    for snapshot in (after_7, after_30):
        chart_total = sum(d["revenue_cents"] for d in snapshot["revenue_by_day"])
        assert chart_total == snapshot["kpis"]["revenue_cents"], "headline and chart must use one definition"
    assert after_7["todo"]["to_process"] - before_7["todo"]["to_process"] == 1  # the 'paid' one


def test_period_bounds_cover_the_requested_days():
    for key, days in dashboard_service.RANGES.items():
        start, end, prev_start, dates = dashboard_service.period_bounds(key)
        assert len(dates) == days
        assert end - start == timedelta(days=days)
        assert start - prev_start == timedelta(days=days)
