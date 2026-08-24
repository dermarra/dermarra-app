from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.product import Product
from app.models.wishlist import Wishlist, WishlistItem

wishlist_bp = Blueprint("wishlist", __name__)


def _get_or_create_wishlist(user_id):
    wishlist = Wishlist.query.filter_by(user_id=user_id).first()
    if not wishlist:
        wishlist = Wishlist(user_id=user_id)
        db.session.add(wishlist)
        db.session.commit()
    return wishlist


@wishlist_bp.get("")
@jwt_required()
def get_wishlist():
    wishlist = _get_or_create_wishlist(get_jwt_identity())
    return jsonify(wishlist.to_dict()), 200


@wishlist_bp.post("/items")
@jwt_required()
def add_item():
    data = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    if not Product.query.get(product_id):
        return jsonify({"error": "product not found"}), 404

    wishlist = _get_or_create_wishlist(get_jwt_identity())
    already_saved = any(item.product_id == product_id for item in wishlist.items)
    if not already_saved:
        wishlist.items.append(WishlistItem(product_id=product_id))
        db.session.commit()
    return jsonify(wishlist.to_dict()), 200


@wishlist_bp.delete("/items/<item_id>")
@jwt_required()
def remove_item(item_id):
    wishlist = _get_or_create_wishlist(get_jwt_identity())
    item = next((i for i in wishlist.items if i.id == item_id), None)
    if not item:
        return jsonify({"error": "wishlist item not found"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify(wishlist.to_dict()), 200


@wishlist_bp.delete("/items/by-product/<product_id>")
@jwt_required()
def remove_item_by_product(product_id):
    """Convenience endpoint for the ProductCard heart toggle, which only
    knows the product_id, not the wishlist item id."""
    wishlist = _get_or_create_wishlist(get_jwt_identity())
    item = next((i for i in wishlist.items if i.product_id == product_id), None)
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify(wishlist.to_dict()), 200
