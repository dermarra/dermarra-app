from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.cart import Cart, CartItem
from app.models.product import Product
from app.models.routine import Routine

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
    product_id = data.get("product_id")
    routine_id = data.get("routine_id")
    quantity = int(data.get("quantity", 1))

    if not product_id and not routine_id:
        return jsonify({"error": "either product_id or routine_id is required"}), 400
    if product_id and routine_id:
        return jsonify({"error": "provide only one of product_id or routine_id"}), 400
    if quantity < 1:
        return jsonify({"error": "quantity must be at least 1"}), 400

    if product_id and not Product.query.get(product_id):
        return jsonify({"error": "product not found"}), 404
    if routine_id and not Routine.query.get(routine_id):
        return jsonify({"error": "routine not found"}), 404

    cart = _get_or_create_cart(get_jwt_identity())

    existing = next(
        (
            item
            for item in cart.items
            if item.product_id == product_id and item.routine_id == routine_id
        ),
        None,
    )
    if existing:
        existing.quantity += quantity
    else:
        cart.items.append(CartItem(product_id=product_id, routine_id=routine_id, quantity=quantity))

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
