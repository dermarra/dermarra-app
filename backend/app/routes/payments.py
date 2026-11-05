from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.order import Order
from app.services import mpesa_service, payment_service
from app.services.inventory_service import InsufficientStockError, ensure_reservations_for_order
from app.services.mpesa_service import DarajaError


payments_bp = Blueprint("payments", __name__)


@payments_bp.post("/mpesa/stk-push")
@jwt_required()
def initiate_stk_push():
    """Kicks off Lipa Na M-Pesa Online for an order awaiting payment.
    Frontend shows 'Enter your M-Pesa PIN' then polls /mpesa/status/<order_id>,
    which also asks Daraja directly -- so a payment resolves even if the
    /mpesa/callback webhook never arrives (dead ngrok tunnel, wrong
    MPESA_CALLBACK_URL).
    """
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id")
    raw_phone = data.get("phone")

    if not order_id or not raw_phone:
        return jsonify({"error": "order_id and phone are required"}), 400

    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if order.status not in ("pending", "payment_failed"):
        return jsonify({"error": f"order is already {order.status.replace('_', ' ')}"}), 400

    try:
        phone = mpesa_service.format_phone(raw_phone)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    amount_kes = round(order.total_cents / 100)
    if amount_kes < 1:
        return jsonify({"error": "M-Pesa can't charge less than KES 1 -- this order can't be paid by M-Pesa"}), 400

    # Hold the stock *before* asking for money: a retry after a failed
    # attempt (reservations released) or after the 20-minute hold lapsed
    # used to go ahead with nothing reserved, so a successful payment then
    # deducted no stock at all.
    try:
        ensure_reservations_for_order(order)
    except InsufficientStockError as e:
        db.session.rollback()
        return jsonify({
            "error": f"Sorry, these are no longer in stock: {', '.join(sorted(e.shortages))}"
        }), 409
    db.session.commit()  # keep the hold even if the STK call below fails

    try:
        result = mpesa_service.stk_push(
            phone=phone,
            amount_kes=amount_kes,
            account_reference=order.id,
            transaction_desc=f"Order {order.id[:8]}",
        )
    except DarajaError as e:
        current_app.logger.error(f"M-Pesa STK push rejected for order {order.id}: {e}")
        return jsonify({"error": f"M-Pesa rejected the payment request: {e}"}), 502
    except Exception as e:
        current_app.logger.error(f"M-Pesa STK push failed for order {order.id}: {e}")
        return jsonify({"error": "could not reach M-Pesa -- please try again"}), 502

    if result.get("ResponseCode") != "0":
        return jsonify({"error": result.get("ResponseDescription", "STK push was rejected")}), 502

    order.payment_method = "mpesa"
    order.mpesa_phone = phone
    order.mpesa_checkout_request_id = result["CheckoutRequestID"]
    order.mpesa_merchant_request_id = result["MerchantRequestID"]
    order.mpesa_receipt_number = None
    order.status = "payment_pending"
    db.session.commit()

    return jsonify({"message": "STK push sent -- enter your M-Pesa PIN on your phone", "order": order.to_dict()}), 200


@payments_bp.get("/mpesa/status/<order_id>")
@jwt_required()
def payment_status(order_id):
    """Polled by the frontend every few seconds. While a push is in flight
    this also asks Daraja directly (throttled), so the order resolves even
    when the callback is lost."""
    user_id = get_jwt_identity()
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()

    try:
        result = payment_service.check_with_daraja(order)
    except Exception as e:
        current_app.logger.warning(f"Daraja status check failed for order {order.id}: {e}")
        result = None

    if result is not None:
        outcome = payment_service.apply_daraja_result(order, result.get("ResultCode"))
        if outcome:
            db.session.commit()
            if outcome == "paid":
                payment_service.send_paid_email(order)

    return jsonify({
        "status": order.status,
        "mpesa_receipt_number": order.mpesa_receipt_number,
        "result_description": (result or {}).get("ResultDesc"),
    }), 200


@payments_bp.post("/mpesa/callback")
def mpesa_callback():
    """Safaricom's server-to-server webhook. MPESA_CALLBACK_URL must point
    here and be public HTTPS (on Render:
    https://dermarra-backend.onrender.com/api/payments/mpesa/callback).

    This endpoint is unauthenticated, so a success claim is never trusted
    on its own: it's confirmed with Daraja's query API before the order is
    marked paid (forging a "paid" callback used to get an order for free).
    If that confirmation can't be made right now, the order stays
    payment_pending and the status poll / admin refresh resolves it.
    Always answers 200 "Accepted" -- Safaricom retries otherwise."""
    accepted = jsonify({"ResultCode": 0, "ResultDesc": "Accepted"}), 200
    payload = request.get_json(silent=True) or {}
    current_app.logger.info(f"M-Pesa callback received: {payload}")

    stk_callback = payload.get("Body", {}).get("stkCallback", {})
    checkout_request_id = stk_callback.get("CheckoutRequestID")
    result_code = stk_callback.get("ResultCode")

    if not checkout_request_id:
        return accepted

    order = Order.query.filter_by(mpesa_checkout_request_id=checkout_request_id).first()
    if not order:
        current_app.logger.warning(f"No order found for CheckoutRequestID {checkout_request_id}")
        return accepted

    if not mpesa_service.is_success(result_code):
        if payment_service.mark_order_failed(order):
            db.session.commit()
        return accepted

    if order.status in payment_service.PAID_OR_LATER:
        return accepted  # duplicate delivery

    metadata = {
        item.get("Name"): item.get("Value")
        for item in stk_callback.get("CallbackMetadata", {}).get("Item", [])
    }
    receipt = metadata.get("MpesaReceiptNumber")

    try:
        verified = mpesa_service.query_stk_status(checkout_request_id)
    except Exception as e:
        current_app.logger.warning(
            f"Couldn't verify success callback for order {order.id} yet ({e}) -- left for the status poll"
        )
        if receipt:
            order.mpesa_receipt_number = str(receipt)
            db.session.commit()
        return accepted

    verified_code = verified.get("ResultCode")
    if mpesa_service.is_success(verified_code):
        if payment_service.mark_order_paid(order, str(receipt) if receipt else None):
            db.session.commit()
            payment_service.send_paid_email(order)
    elif verified_code is not None:
        current_app.logger.warning(
            f"Success callback for order {order.id} contradicted by Daraja (ResultCode {verified_code}) -- ignored"
        )
    elif receipt:
        # Daraja still reports it as processing -- keep the receipt for
        # when the status poll confirms it.
        order.mpesa_receipt_number = str(receipt)
        db.session.commit()
    return accepted
