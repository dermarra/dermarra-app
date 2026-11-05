"""Payment-outcome coverage for payment_service.py and the M-Pesa routes:
every path that marks an order paid must actually deduct stock (retry after
a failed attempt, slow payer whose hold expired, admin/poll confirmation),
a failure can never downgrade a paid order, and an unauthenticated success
callback is only trusted once Daraja's own query API confirms it.

Daraja and Brevo are stubbed (monkeypatch) -- these never hit Safaricom or
send email. Like the other suites, they run against the real dev DB (see
conftest.py) and clean up after themselves.
"""
from datetime import date, datetime, timedelta, timezone

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models.inventory import Inventory, InventoryReservation
from app.models.order import Order
from app.services import inventory_service, mpesa_service, payment_service
from app.services.inventory_service import InsufficientStockError, InventoryError


def _inv(variant_id):
    db.session.expire_all()
    return Inventory.query.filter_by(variant_id=variant_id).first()


def _order(order_id):
    db.session.expire_all()
    return Order.query.get(order_id)


@pytest.fixture
def stocked_order(make_variant, make_order):
    """A variant with 10 units in one batch, and a 2-unit order with its
    stock already reserved (the state right after checkout)."""
    def _make(quantity=2, stock=10):
        variant = make_variant(name="__TEST__ payments")
        inventory_service.record_production_run(variant.id, batch_number="B1", quantity_produced=stock)
        db.session.commit()
        order = make_order(variant, quantity=quantity)
        inventory_service.reserve_stock_for_order(order)
        db.session.commit()
        return variant, order
    return _make


@pytest.fixture(autouse=True)
def _no_emails(monkeypatch):
    monkeypatch.setattr(payment_service, "send_paid_email", lambda order: None)


# ---------- mark_order_paid ----------

def test_paid_consumes_reserved_stock(app, stocked_order):
    variant, order = stocked_order()
    assert payment_service.mark_order_paid(order, "RCPT1") is True
    db.session.commit()

    inv = _inv(variant.id)
    assert (inv.on_hand, inv.reserved) == (8, 0)
    refreshed = _order(order.id)
    assert refreshed.status == "paid" and refreshed.paid_at is not None
    assert refreshed.mpesa_receipt_number == "RCPT1"


def test_paid_after_failed_attempt_still_deducts_stock(app, stocked_order):
    """The original bug: payment_failed released the hold, a retry paid,
    and nothing was deducted because there was no active reservation."""
    variant, order = stocked_order()
    order.status = "payment_pending"
    payment_service.mark_order_failed(order)
    db.session.commit()
    assert _inv(variant.id).reserved == 0

    payment_service.mark_order_paid(order)
    db.session.commit()
    inv = _inv(variant.id)
    assert (inv.on_hand, inv.reserved) == (8, 0)
    assert inventory_service.has_sale_transactions(order)


def test_paid_after_reservation_expired_still_deducts_stock(app, stocked_order):
    variant, order = stocked_order()
    for r in InventoryReservation.query.filter_by(order_id=order.id).all():
        r.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.session.commit()
    inventory_service.expire_stale_reservations()
    db.session.commit()
    assert _inv(variant.id).reserved == 0

    payment_service.mark_order_paid(order)
    db.session.commit()
    assert _inv(variant.id).on_hand == 8


def test_paid_is_idempotent(app, stocked_order):
    variant, order = stocked_order()
    payment_service.mark_order_paid(order)
    db.session.commit()
    assert payment_service.mark_order_paid(order) is False
    db.session.commit()
    assert _inv(variant.id).on_hand == 8, "a duplicate confirmation must not deduct twice"


def test_paid_when_stock_sold_out_still_records_payment(app, make_variant, make_order):
    """Money already moved -- the order must become paid even if its stock
    is gone, with the shortfall visible (no SALE rows) instead of a 500."""
    variant = make_variant(name="__TEST__ sold-out")
    inventory_service.record_production_run(variant.id, batch_number="B1", quantity_produced=1)
    db.session.commit()
    order = make_order(variant, quantity=2)  # never reserved, can't be
    db.session.commit()

    assert payment_service.mark_order_paid(order) is True
    db.session.commit()
    assert _order(order.id).status == "paid"
    assert not inventory_service.has_sale_transactions(order)
    assert _inv(variant.id).on_hand == 1


# ---------- mark_order_failed ----------

def test_failure_never_downgrades_a_paid_order(app, stocked_order):
    variant, order = stocked_order()
    payment_service.mark_order_paid(order)
    db.session.commit()

    assert payment_service.mark_order_failed(order) is False
    db.session.commit()
    assert _order(order.id).status == "paid"
    assert _inv(variant.id).on_hand == 8


# ---------- reservations ----------

def test_reservation_refuses_stock_only_in_expired_batches(app, make_variant, make_order):
    variant = make_variant(name="__TEST__ expired-only")
    inventory_service.record_production_run(
        variant.id, batch_number="OLD", quantity_produced=5, expiry_date=date.today() - timedelta(days=1)
    )
    db.session.commit()
    order = make_order(variant, quantity=1)
    db.session.commit()

    with pytest.raises(InsufficientStockError):
        inventory_service.reserve_stock_for_order(order)
    db.session.rollback()


def test_ensure_reservations_extends_an_active_hold(app, stocked_order):
    _, order = stocked_order()
    soon = datetime.now(timezone.utc) + timedelta(minutes=2)
    for r in InventoryReservation.query.filter_by(order_id=order.id).all():
        r.expires_at = soon
    db.session.commit()

    inventory_service.ensure_reservations_for_order(order)
    db.session.commit()
    db.session.expire_all()
    reservations = InventoryReservation.query.filter_by(order_id=order.id, status="active").all()
    assert len(reservations) == 1
    assert reservations[0].expires_at > soon.replace(tzinfo=None) + timedelta(minutes=10)


def test_adjustment_cannot_eat_reserved_stock(app, stocked_order):
    variant, order = stocked_order(quantity=8, stock=10)  # 8 reserved, 2 free
    batch_id = inventory_service.InventoryBatch.query.filter_by(variant_id=variant.id).first().id

    with pytest.raises(InventoryError):
        inventory_service.adjust_stock(
            variant.id, batch_id=batch_id, transaction_type="DAMAGE", quantity=3, reason="dropped"
        )
    db.session.rollback()

    inventory_service.adjust_stock(
        variant.id, batch_id=batch_id, transaction_type="DAMAGE", quantity=2, reason="dropped"
    )
    db.session.commit()
    assert _inv(variant.id).on_hand == 8


# ---------- Daraja helpers ----------

def test_is_success_accepts_int_and_string_codes():
    assert mpesa_service.is_success(0) and mpesa_service.is_success("0")
    assert not mpesa_service.is_success(1032) and not mpesa_service.is_success("1037")
    assert not mpesa_service.is_success(None)


# ---------- Routes ----------

def _callback(client, checkout_id, result_code, receipt="SBX123", result_desc=None):
    item = [{"Name": "MpesaReceiptNumber", "Value": receipt}] if result_code == 0 else []
    return client.post("/api/payments/mpesa/callback", json={
        "Body": {"stkCallback": {
            "CheckoutRequestID": checkout_id,
            "ResultCode": result_code,
            "ResultDesc": result_desc,
            "CallbackMetadata": {"Item": item},
        }}
    })


def _in_flight(order, checkout_id):
    order.status = "payment_pending"
    order.mpesa_checkout_request_id = checkout_id
    db.session.commit()


def test_forged_success_callback_is_ignored(app, stocked_order, monkeypatch):
    """Daraja says the payment was cancelled -- a callback claiming success
    must not mark the order paid (this used to be a free-order exploit)."""
    variant, order = stocked_order()
    _in_flight(order, "__TEST__forged")
    monkeypatch.setattr(mpesa_service, "query_stk_status", lambda cid: {"ResultCode": "1032"})

    assert _callback(app.test_client(), "__TEST__forged", 0).status_code == 200
    assert _order(order.id).status == "payment_pending"
    assert _inv(variant.id).on_hand == 10


def test_verified_success_callback_marks_paid(app, stocked_order, monkeypatch):
    variant, order = stocked_order()
    _in_flight(order, "__TEST__real")
    monkeypatch.setattr(mpesa_service, "query_stk_status", lambda cid: {"ResultCode": "0"})

    _callback(app.test_client(), "__TEST__real", 0, receipt="SBX999")
    refreshed = _order(order.id)
    assert refreshed.status == "paid"
    assert refreshed.mpesa_receipt_number == "SBX999"
    assert _inv(variant.id).on_hand == 8


def test_late_failure_callback_does_not_touch_paid_order(app, stocked_order):
    variant, order = stocked_order()
    _in_flight(order, "__TEST__late")
    payment_service.mark_order_paid(order)
    db.session.commit()

    _callback(app.test_client(), "__TEST__late", 1032)
    assert _order(order.id).status == "paid"


def test_status_poll_resolves_payment_without_any_callback(app, stocked_order, monkeypatch, test_user):
    """The dead-ngrok case: no callback ever arrives, the frontend's status
    poll asks Daraja directly and the order still completes."""
    variant, order = stocked_order()
    _in_flight(order, "__TEST__poll")
    monkeypatch.setattr(mpesa_service, "query_stk_status", lambda cid: {"ResultCode": "0"})
    payment_service._last_daraja_check.pop(order.id, None)

    token = create_access_token(identity=test_user.id)
    resp = app.test_client().get(
        f"/api/payments/mpesa/status/{order.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "paid"
    assert _inv(variant.id).on_hand == 8


def test_status_poll_leaves_pending_payment_alone(app, stocked_order, monkeypatch, test_user):
    _, order = stocked_order()
    _in_flight(order, "__TEST__pending")
    monkeypatch.setattr(
        mpesa_service, "query_stk_status", lambda cid: {"errorCode": mpesa_service.PENDING_ERROR_CODE}
    )
    payment_service._last_daraja_check.pop(order.id, None)

    token = create_access_token(identity=test_user.id)
    resp = app.test_client().get(
        f"/api/payments/mpesa/status/{order.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.get_json()["status"] == "payment_pending"


def test_failure_callback_records_safaricoms_reason(app, stocked_order, test_user):
    """The reason must reach the customer whichever path learned the result
    -- it used to be shown only when the status poll itself asked Daraja."""
    variant, order = stocked_order()
    _in_flight(order, "__TEST__reason")

    _callback(app.test_client(), "__TEST__reason", 1032, result_desc="Request Cancelled by user.")
    refreshed = _order(order.id)
    assert refreshed.status == "payment_failed"
    assert refreshed.payment_failure_reason == "Request Cancelled by user."
    assert _inv(variant.id).reserved == 0

    token = create_access_token(identity=test_user.id)
    resp = app.test_client().get(
        f"/api/payments/mpesa/status/{order.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.get_json()["result_description"] == "Request Cancelled by user."

    payment_service.mark_order_paid(refreshed)
    db.session.commit()
    assert _order(order.id).payment_failure_reason is None, "a later success clears the old reason"
