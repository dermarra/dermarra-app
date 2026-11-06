"""Admin dashboard figures for a chosen period, in Kenyan time (EAT, UTC+3,
no DST).

Revenue is defined ONCE here: an order that reached paid-or-later, counted
on the day it was paid (``paid_at``; ``created_at`` only as a fallback for a
legacy row with no payment timestamp). The headline total and the daily
chart both use this same definition, so they can never disagree again (the
old dashboard summed all-time revenue but charted by paid_at, so a single
order with no paid_at showed "KES 18,360" next to "No revenue yet").
Cancelled orders are excluded (a cancelled paid order is refunded).

Volumes here are small (a single shop), so orders in the window are loaded
and aggregated in Python -- simpler to read than a pile of SQL, and the
window keeps it bounded.
"""
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone

from app.models.inventory import InventoryBatch
from app.models.order import Order
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.services import inventory_service
from app.services.payment_service import PAID_OR_LATER

EAT = timezone(timedelta(hours=3))
RANGES = {"today": 1, "7d": 7, "30d": 30, "90d": 90}
DEFAULT_RANGE = "7d"
STUCK_PAYMENT_MINUTES = 10


def _to_naive_utc(dt):
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _eat_date(naive_utc):
    return naive_utc.replace(tzinfo=timezone.utc).astimezone(EAT).date()


def _paid_ts(order):
    return order.paid_at or order.created_at


def period_bounds(range_key, today=None):
    """(start, end, prev_start) as naive-UTC datetimes, plus the list of EAT
    dates in the period. "7d" = today and the 6 days before it."""
    days = RANGES[range_key]
    today = today or datetime.now(EAT).date()
    first_day = today - timedelta(days=days - 1)
    start = datetime.combine(first_day, time.min, tzinfo=EAT)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=EAT)
    prev_start = start - timedelta(days=days)
    dates = [first_day + timedelta(days=i) for i in range(days)]
    return _to_naive_utc(start), _to_naive_utc(end), _to_naive_utc(prev_start), dates


def _kpis(orders_created, orders_paid, new_customers):
    revenue = sum(o.total_cents for o in orders_paid)
    paid = len(orders_paid)
    created = len(orders_created)
    converted = sum(1 for o in orders_created if o.status in PAID_OR_LATER)
    return {
        "revenue_cents": revenue,
        "paid_orders": paid,
        "average_order_cents": round(revenue / paid) if paid else 0,
        "orders_created": created,
        "conversion_rate": round(converted / created, 4) if created else None,
        "new_customers": new_customers,
    }


def _window(orders, start, end, key):
    return [o for o in orders if start <= key(o) < end]


def _outcome_label(order):
    if order.status in PAID_OR_LATER:
        return "Paid"
    if order.status in ("pending", "payment_pending"):
        return "Awaiting payment"
    reason = (order.payment_failure_reason or "").strip().rstrip(".")
    if reason:
        return reason
    return "Payment failed" if order.status == "payment_failed" else "Cancelled"


def _todo(now_naive):
    counts = Counter(status for (status,) in Order.query.with_entities(Order.status).all())
    stuck_cutoff = now_naive - timedelta(minutes=STUCK_PAYMENT_MINUTES)
    stuck = Order.query.filter(Order.status == "payment_pending", Order.created_at < stuck_cutoff).count()

    sellable = (
        ProductVariant.query.join(ProductVariant.product)
        .filter(ProductVariant.is_active.is_(True), Product.is_active.is_(True))
        .all()
    )
    statuses = [(v, v.inventory.stock_status() if v.inventory else "out_of_stock") for v in sellable]
    expiring = InventoryBatch.query.filter(
        InventoryBatch.status == "active",
        InventoryBatch.quantity_remaining > 0,
        InventoryBatch.expiry_date.isnot(None),
        InventoryBatch.expiry_date <= date.today() + timedelta(days=30),
    ).count()
    unallocated = sum(
        1
        for o in Order.query.filter(Order.status.in_(("paid", "processing", "shipped"))).all()
        if not inventory_service.has_sale_transactions(o)
    )
    return {
        "to_process": counts.get("paid", 0),
        "to_ship": counts.get("processing", 0),
        "in_transit": counts.get("shipped", 0),
        "stuck_payments": stuck,
        "low_stock_sizes": sum(1 for _, s in statuses if s == "low_stock"),
        "out_of_stock_sizes": sum(1 for _, s in statuses if s == "out_of_stock"),
        "expiring_batches": expiring,
        "unallocated_paid_orders": unallocated,
        "products_without_sizes": Product.query.filter(~Product.variants.any()).count(),
    }, statuses


def build_dashboard(range_key=DEFAULT_RANGE):
    if range_key not in RANGES:
        range_key = DEFAULT_RANGE
    start, end, prev_start, dates = period_bounds(range_key)
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    # Everything that could fall in either the current or previous window.
    orders = Order.query.filter(
        (Order.created_at >= prev_start) | (Order.paid_at >= prev_start)
    ).all()
    paid = [o for o in orders if o.status in PAID_OR_LATER]

    cur_created = _window(orders, start, end, lambda o: o.created_at)
    prev_created = _window(orders, prev_start, start, lambda o: o.created_at)
    cur_paid = _window(paid, start, end, _paid_ts)
    prev_paid = _window(paid, prev_start, start, _paid_ts)

    customers = User.query.filter(User.is_admin.is_(False), User.created_at >= prev_start).all()
    cur_new = sum(1 for u in customers if start <= u.created_at < end)
    prev_new = sum(1 for u in customers if prev_start <= u.created_at < start)

    by_day = defaultdict(lambda: {"revenue_cents": 0, "paid_orders": 0})
    for o in cur_paid:
        d = _eat_date(_paid_ts(o))
        by_day[d]["revenue_cents"] += o.total_cents
        by_day[d]["paid_orders"] += 1

    outcomes = Counter(_outcome_label(o) for o in cur_created)

    items = defaultdict(lambda: {"units": 0, "revenue_cents": 0, "kind": "product"})
    for o in cur_paid:
        for item in o.items:
            row = items[item.name_snapshot]
            row["units"] += item.quantity
            row["revenue_cents"] += item.unit_price_cents_snapshot * item.quantity
            if item.routine_id:
                row["kind"] = "routine"
    top_items = sorted(
        ({"name": name, **vals} for name, vals in items.items()),
        key=lambda r: (r["revenue_cents"], r["units"]),
        reverse=True,
    )[:5]

    coupons = defaultdict(lambda: {"uses": 0, "discount_cents": 0})
    for o in cur_paid:
        if o.coupon_code_snapshot:
            coupons[o.coupon_code_snapshot]["uses"] += 1
            coupons[o.coupon_code_snapshot]["discount_cents"] += o.discount_cents or 0

    todo, variant_statuses = _todo(now_naive)
    low_stock = sorted(
        (
            {
                "variant_id": v.id,
                "product_name": v.product.name,
                "label": v.label,
                "available": v.inventory.available if v.inventory else 0,
                "reorder_level": v.inventory.reorder_level if v.inventory else 0,
                "stock_status": s,
            }
            for v, s in variant_statuses
            if s in ("low_stock", "out_of_stock")
        ),
        key=lambda r: r["available"],
    )[:6]

    recent = Order.query.order_by(Order.created_at.desc()).limit(8).all()

    return {
        "range": range_key,
        "period": {
            "start": dates[0].isoformat(),
            "end": dates[-1].isoformat(),
            "days": len(dates),
            "timezone": "Africa/Nairobi (EAT)",
        },
        "kpis": _kpis(cur_created, cur_paid, cur_new),
        "previous_kpis": _kpis(prev_created, prev_paid, prev_new),
        "revenue_by_day": [
            {"date": d.isoformat(), **(by_day[d] if d in by_day else {"revenue_cents": 0, "paid_orders": 0})}
            for d in dates
        ],
        "payment_outcomes": [{"label": k, "count": v} for k, v in outcomes.most_common()],
        "top_items": top_items,
        "coupon_usage": [{"code": k, **v} for k, v in sorted(coupons.items(), key=lambda kv: -kv[1]["uses"])],
        "todo": todo,
        "low_stock": low_stock,
        "catalog": {
            "products": Product.query.filter_by(is_active=True).count(),
            "sizes": len(variant_statuses),
        },
        "recent_orders": [
            {
                "id": o.id,
                "status": o.status,
                "total_cents": o.total_cents,
                "created_at": o.created_at.isoformat(),
                "customer_name": o.user.full_name if o.user else None,
                "customer_email": o.user.email if o.user else None,
                "item_count": sum(i.quantity for i in o.items),
            }
            for o in recent
        ],
    }
