"""The one place an order's payment outcome is applied.

Every route that learns an STK push's result -- the Safaricom callback, the
customer's status poll, the customer cancel flow, the admin "refresh payment
status" button -- goes through mark_order_paid / mark_order_failed here, so
stock consumption, coupon accounting and status changes can't drift apart
between paths (they used to: the admin refresh marked orders paid without
ever consuming stock, and a late failure callback could overwrite a paid
order).

Like inventory_service/coupon_service, nothing here commits -- the caller
owns the transaction. Call send_paid_email() *after* committing.
"""
import time
from datetime import datetime, timedelta, timezone

from flask import current_app

from app.extensions import db
from app.models.order import Order
from app.models.user import User
from app.services import coupon_service, inventory_service, mpesa_service
from app.services.brevo_service import send_order_confirmation_email
from app.services.inventory_service import InsufficientStockError

PAID_OR_LATER = ("paid", "processing", "shipped", "delivered")
AWAITING_PAYMENT = ("pending", "payment_pending", "payment_failed")

# Status polls hit Daraja at most this often per order. Per-process memory
# is enough: the worst case with several gunicorn workers is a few extra
# queries, not wrong results.
_DARAJA_CHECK_INTERVAL_SECONDS = 15  # Daraja's query API 429s on rapid calls
_last_daraja_check = {}


def mark_order_paid(order, receipt_number=None):
    """Records a confirmed payment. Returns True if the order transitioned
    to paid (so the caller should send the confirmation email), False if it
    was already paid (duplicate callback / poll race) -- idempotent.

    Money has already moved by the time this runs, so it never refuses:
    if stock can't be consumed (the reservation lapsed and the stock has
    since sold out), the order is still marked paid and the shortfall is
    logged -- admins see it via Order "stock_allocated: false"."""
    if order.status in PAID_OR_LATER:
        if receipt_number and not order.mpesa_receipt_number:
            order.mpesa_receipt_number = receipt_number
        return False

    was_cancelled = order.status == "cancelled"
    order.payment_failure_reason = None
    if receipt_number:
        order.mpesa_receipt_number = receipt_number
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)

    if was_cancelled and order.coupon_id:
        # cancel released the coupon use -- the sale completed after all.
        coupon_service.reclaim_usage(order)

    if not inventory_service.has_sale_transactions(order):
        savepoint = db.session.begin_nested()
        try:
            # Re-reserves if the hold was released (failed attempt, retry)
            # or expired (slow payer) -- previously a no-op in that case,
            # which marked orders paid without deducting any stock.
            inventory_service.ensure_reservations_for_order(order)
            inventory_service.consume_reservations_for_order(order)
            savepoint.commit()
        except InsufficientStockError as e:
            savepoint.rollback()
            current_app.logger.error(
                f"Order {order.id} is PAID but stock could not be allocated: {e.shortages}. "
                "Needs manual fulfilment review."
            )
    return True


def mark_order_failed(order, reason=None):
    """Records a failed/cancelled STK attempt. Only applies to an order
    actually awaiting payment -- a stale or forged failure callback can
    never downgrade a paid (or cancelled) order. Releases the stock hold;
    the coupon stays attached so a retry keeps the discount."""
    if order.status not in ("pending", "payment_pending"):
        return False
    inventory_service.release_reservations_for_order(order)
    order.status = "payment_failed"
    order.payment_failure_reason = (str(reason).strip()[:255] or None) if reason else None
    return True


def apply_daraja_result(order, result_code, receipt_number=None, result_desc=None):
    """Applies a Daraja ResultCode (int from the callback, str from the
    query API), recording Safaricom's ResultDesc as the failure reason.
    Returns "paid", "failed" or None (still pending/unknown)."""
    if result_code is None:
        return None
    if mpesa_service.is_success(result_code):
        mark_order_paid(order, receipt_number)
        return "paid"
    mark_order_failed(order, reason=result_desc)
    return "failed"


def check_with_daraja(order, *, throttle=True):
    """Asks Daraja for the live result of an in-flight STK push. Returns
    the raw query response, or None if skipped (throttled / nothing in
    flight). Raises mpesa_service errors on genuine query failures."""
    if order.status != "payment_pending" or not order.mpesa_checkout_request_id:
        return None
    if throttle:
        now = time.monotonic()
        last = _last_daraja_check.get(order.id)
        if last is not None and now - last < _DARAJA_CHECK_INTERVAL_SECONDS:
            return None
        _last_daraja_check[order.id] = now
    return mpesa_service.query_stk_status(order.mpesa_checkout_request_id)


ABANDONED_ORDER_HOURS = 24
ABANDONED_REASON = "Closed automatically: not paid within 24 hours."


def expire_abandoned_orders(max_age_hours=ABANDONED_ORDER_HOURS):
    """Closes unpaid orders older than `max_age_hours` (owner's rule,
    2026-11-06: 24h): status -> cancelled, any stock hold released, coupon
    use given back. Only `pending` / `payment_failed` -- never
    `payment_pending`: an in-flight STK push must be confirmed with Safaricom
    before it's cancelled (see orders.cancel_order), so those surface as
    "stuck payments" on the dashboard instead. No background worker exists,
    so this runs lazily (dashboard, order lists, STK push) and from the
    expire-reservations cron endpoint. Returns how many were closed; caller
    commits."""
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=max_age_hours)
    stale = Order.query.filter(
        Order.status.in_(("pending", "payment_failed")), Order.created_at < cutoff
    ).all()
    for order in stale:
        inventory_service.release_reservations_for_order(order)
        coupon_service.release_usage(order)
        order.status = "cancelled"
        order.payment_failure_reason = ABANDONED_REASON
    return len(stale)


def send_paid_email(order):
    try:
        user = User.query.get(order.user_id)
        send_order_confirmation_email(user, order)
    except Exception:
        current_app.logger.exception(f"Order confirmation email failed for order {order.id}")
