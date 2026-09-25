from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.cart import Cart, CartItem
from app.models.product import ProductVariant
from app.models.routine import Routine
from app.models.user import User
from app.services import coupon_service
from app.services.coupon_service import CouponError
from app.utils.cart_totals import cart_subtotal_cents

cart_bp = Blueprint("cart", __name__)


def _get_or_create_cart(user_id):
    cart = Cart.query.filter_by(user_id=user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.session.add(cart)
        db.session.commit()
    return cart


@cart_bp.get("")
@jwt_required()
def get_cart():
    cart = _get_or_create_cart(get_jwt_identity())
    return jsonify(cart.to_dict()), 200


@cart_bp.post("/items")
@jwt_required()
def add_item():
    data = request.get_json(silent=True) or {}
    variant_id = data.get("variant_id")
    routine_id = data.get("routine_id")
    quantity = int(data.get("quantity", 1))

    if not variant_id and not routine_id:
        return jsonify({"error": "either variant_id or routine_id is required"}), 400
    if variant_id and routine_id:
        return jsonify({"error": "provide only one of variant_id or routine_id"}), 400
    if quantity < 1:
        return jsonify({"error": "quantity must be at least 1"}), 400

    if variant_id and not ProductVariant.query.get(variant_id):
        return jsonify({"error": "product variant not found"}), 404
    if routine_id and not Routine.query.get(routine_id):
        return jsonify({"error": "routine not found"}), 404

    cart = _get_or_create_cart(get_jwt_identity())

    existing = next(
        (
            item
            for item in cart.items
            if item.variant_id == variant_id and item.routine_id == routine_id
        ),
        None,
    )
    if existing:
        existing.quantity += quantity
    else:
        cart.items.append(CartItem(variant_id=variant_id, routine_id=routine_id, quantity=quantity))

    db.session.commit()
    return jsonify(cart.to_dict()), 200


@cart_bp.patch("/items/<item_id>")
@jwt_required()
def update_item(item_id):
    data = request.get_json(silent=True) or {}
    quantity = data.get("quantity")
    if quantity is None or int(quantity) < 1:
        return jsonify({"error": "quantity must be at least 1"}), 400

    cart = _get_or_create_cart(get_jwt_identity())
    item = next((i for i in cart.items if i.id == item_id), None)
    if not item:
        return jsonify({"error": "cart item not found"}), 404

    item.quantity = int(quantity)
    db.session.commit()
    return jsonify(cart.to_dict()), 200


@cart_bp.delete("/items/<item_id>")
@jwt_required()
def remove_item(item_id):
    cart = _get_or_create_cart(get_jwt_identity())
    item = next((i for i in cart.items if i.id == item_id), None)
    if not item:
        return jsonify({"error": "cart item not found"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify(cart.to_dict()), 200


@cart_bp.post("/apply-coupon")
@jwt_required()
def apply_coupon():
    """Preview only -- does not spend a use. The coupon is re-validated
    (and actually spent) again at checkout, since it could expire or hit
    max_uses between now and then."""
    data = request.get_json(silent=True) or {}
    code = data.get("code")

    user = User.query.get(get_jwt_identity())
    cart = _get_or_create_cart(user.id)
    if not cart.items:
        return jsonify({"error": "cart is empty"}), 400

    try:
        coupon, _ = coupon_service.validate_and_price(code, user, cart_subtotal_cents(cart))
    except CouponError as e:
        return jsonify({"error": str(e)}), 400

    cart.coupon_id = coupon.id
    db.session.commit()
    return jsonify(cart.to_dict()), 200


@cart_bp.delete("/coupon")
@jwt_required()
def remove_coupon():
    cart = _get_or_create_cart(get_jwt_identity())
    cart.coupon_id = None
    db.session.commit()
    return jsonify(cart.to_dict()), 200
