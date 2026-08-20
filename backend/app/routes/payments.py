from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.order import Order
from app.models.product import Product
from app.models.routine import Routine
from app.models.user import User
from app.services import mpesa_service
from app.services.brevo_service import send_order_confirmation_email
from app.utils.inventory import stock_lines


payments_bp = Blueprint("payments", __name__)


@payments_bp.post("/mpesa/stk-push")
@jwt_required()
def initiate_stk_push():
    """Kicks off Lipa Na M-Pesa Online for a pending order. Frontend shows
    'Enter your M-Pesa PIN' then polls /mpesa/status/<order_id> -- Daraja
    is async, real confirmation arrives via the /mpesa/callback webhook.
    """
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id")
    raw_phone = data.get("phone")

    if not order_id or not raw_phone:
        return jsonify({"error": "order_id and phone are required"}), 400

    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    if order.status not in ("pending", "payment_failed"):
        return jsonify({"error": f"order is already {order.status}"}), 400

    try:
        phone = mpesa_service.format_phone(raw_phone)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    amount_kes = round(order.total_cents / 100)

    try:
        result = mpesa_service.stk_push(
            phone=phone,
            amount_kes=amount_kes,
            account_reference=order.id,
            transaction_desc=f"Order {order.id[:8]}",
        )
    except Exception as e:
        current_app.logger.error(f"M-Pesa STK push failed: {e}")
        return jsonify({"error": "could not reach M-Pesa -- please try again"}), 502

    if result.get("ResponseCode") != "0":
        return jsonify({"error": result.get("ResponseDescription", "STK push was rejected")}), 502

    order.payment_method = "mpesa"
    order.mpesa_phone = phone
    order.mpesa_checkout_request_id = result["CheckoutRequestID"]
    order.mpesa_merchant_request_id = result["MerchantRequestID"]
    order.status = "payment_pending"
    db.session.commit()

    return jsonify({"message": "STK push sent -- enter your M-Pesa PIN on your phone", "order": order.to_dict()}), 200


@payments_bp.get("/mpesa/status/<order_id>")
@jwt_required()
def payment_status(order_id):
    user_id = get_jwt_identity()
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    return jsonify({"status": order.status, "mpesa_receipt_number": order.mpesa_receipt_number}), 200


@payments_bp.post("/mpesa/callback")
def mpesa_callback():
    """Safaricom's server-to-server webhook. MPESA_CALLBACK_URL in .env
    must point here and be public HTTPS (use ngrok for local dev)."""
    payload = request.get_json(silent=True) or {}
    current_app.logger.info(f"M-Pesa callback received: {payload}")

    stk_callback = payload.get("Body", {}).get("stkCallback", {})
    checkout_request_id = stk_callback.get("CheckoutRequestID")
    result_code = stk_callback.get("ResultCode")

    if not checkout_request_id:
        return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"}), 200

    order = Order.query.filter_by(mpesa_checkout_request_id=checkout_request_id).first()
    if not order:
        current_app.logger.warning(f"No order found for CheckoutRequestID {checkout_request_id}")
        return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"}), 200
    
    if result_code == 0:
        if order.status != "paid":
            metadata = {
                item["Name"]: item.get("Value")
                for item in stk_callback.get("CallbackMetadata", {}).get("Item", [])
            }
            order.status = "paid"
            order.mpesa_receipt_number = metadata.get("MpesaReceiptNumber")
            order.paid_at = datetime.now(timezone.utc)

            for order_item in order.items:
                product = Product.query.get(order_item.product_id) if order_item.product_id else None
                routine = Routine.query.get(order_item.routine_id) if order_item.routine_id else None
                for product_row, needed_qty in stock_lines(product, routine, order_item.quantity):
                    product_row.stock_quantity = max(0, product_row.stock_quantity - needed_qty)

            db.session.commit()

            try:
                user = User.query.get(order.user_id)
                send_order_confirmation_email(user, order)
            except Exception:
                pass
    else:
        order.status = "payment_failed"
        db.session.commit()

    return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"}), 200
