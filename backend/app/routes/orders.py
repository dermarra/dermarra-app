from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.cart import Cart
from app.models.order import Order, OrderItem
from app.services import mpesa_service

orders_bp = Blueprint("orders", __name__)

SHIPPING_FLAT_CENTS = 0 # Flat shipping fee in cents (e.g., 0 for free shipping, 500 for $5.00 shipping).


@orders_bp.get("")
@jwt_required()
def list_orders():
    user_id = get_jwt_identity()
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200


@orders_bp.get("/<order_id>")
@jwt_required()
def get_order(order_id):
    user_id = get_jwt_identity()
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()
    return jsonify(order.to_dict()), 200


@orders_bp.post("/checkout")
@jwt_required()
def checkout():
    """Creates a 'pending' order from the cart and clears the cart.
    Call POST /api/payments/mpesa/stk-push next to collect payment.
    """
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    shipping = data.get("shipping") or {}

    required_fields = ["name", "address_line1", "city", "country", "postal_code", "phone"]
    missing = [f for f in required_fields if not shipping.get(f)]
    if missing:
        return jsonify({"error": f"missing shipping fields: {', '.join(missing)}"}), 400

    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart or not cart.items:
        return jsonify({"error": "cart is empty"}), 400

    subtotal_cents = 0
    order_items = []
    for item in cart.items:
        if item.product:
            unit_price = item.product.price_cents
            name = item.product.name
        else:
            step_total = sum(step.product.price_cents for step in item.routine.steps)
            discount = item.routine.bundle_discount_percent or 0
            unit_price = round(step_total * (100 - discount) / 100)
            name = f"{item.routine.name} (Full Routine)"

        subtotal_cents += unit_price * item.quantity
        order_items.append(
            OrderItem(
                product_id=item.product_id,
                routine_id=item.routine_id,
                name_snapshot=name,
                unit_price_cents_snapshot=unit_price,
                quantity=item.quantity,
            )
        )

    order = Order(
        user_id=user_id,
        status="pending",
        subtotal_cents=subtotal_cents,
        shipping_cents=SHIPPING_FLAT_CENTS,
        total_cents=subtotal_cents + SHIPPING_FLAT_CENTS,
        shipping_name=shipping["name"],
        shipping_address_line1=shipping["address_line1"],
        shipping_address_line2=shipping.get("address_line2"),
        shipping_city=shipping["city"],
        shipping_country=shipping["country"],
        shipping_postal_code=shipping["postal_code"],
        shipping_phone=shipping["phone"],
        items=order_items,
    )
    db.session.add(order)

    for item in list(cart.items):
        db.session.delete(item)

    db.session.commit()

    return jsonify(order.to_dict()), 201


@orders_bp.post("/<order_id>/cancel")
@jwt_required()
def cancel_order(order_id):
    """Cancels an order that hasn't been paid yet.

    - "pending" / "payment_failed": no live M-Pesa transaction to worry
      about, cancel immediately.
    - "payment_pending": an STK push may still be awaiting the customer's
      PIN entry right now, so we check the REAL status with Safaricom
      before cancelling -- never silently discard money that already moved.
    """
    user_id = get_jwt_identity()
    order = Order.query.filter_by(id=order_id, user_id=user_id).first_or_404()

    if order.status in ("pending", "payment_failed"):
        order.status = "cancelled"
        db.session.commit()
        return jsonify(order.to_dict()), 200

    if order.status == "payment_pending":
        if not order.mpesa_checkout_request_id:
            order.status = "cancelled"
            db.session.commit()
            return jsonify(order.to_dict()), 200

        try:
            result = mpesa_service.query_stk_status(order.mpesa_checkout_request_id)
        except Exception as e:
            current_app.logger.error(f"M-Pesa status query failed during cancel: {e}")
            return jsonify({
                "error": "Couldn't confirm payment status with M-Pesa right now -- please try again in a moment."
            }), 502

        result_code = result.get("ResultCode")

        if result_code is None:
            # Sandbox/production return an error-shaped response (no ResultCode)
            # while the customer hasn't responded on their phone yet -- refuse
            # to cancel until it actually resolves one way or the other.
            return jsonify({
                "error": "This payment is still awaiting your M-Pesa PIN entry. "
                         "Wait about a minute for it to time out, then try cancelling again."
            }), 409

        if str(result_code) == "0":
            # Payment actually succeeded -- the callback just hasn't landed
            # yet. Never lose track of money that already moved.
            order.status = "paid"
            db.session.commit()
            return jsonify({
                "error": "This order was already paid and cannot be cancelled.",
                "order": order.to_dict(),
            }), 409

        # Any other non-zero ResultCode means Safaricom itself reports the
        # transaction as failed/cancelled/timed out -- safe to cancel.
        order.status = "cancelled"
        db.session.commit()
        return jsonify(order.to_dict()), 200

    return jsonify({"error": f"orders with status '{order.status}' cannot be cancelled"}), 400
