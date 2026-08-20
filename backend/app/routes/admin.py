from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.order import Order
from app.models.product import Product, SkinConcern
from app.models.routine import Routine, RoutineStep
from app.models.user import User
from app.services import mpesa_service
from app.services.cloudinary_service import upload_image, delete_image
from app.utils.decorators import admin_required
from app.utils.order_transitions import can_advance, can_cancel

admin_bp = Blueprint("admin", __name__)


# ---------- Skin concerns ----------

@admin_bp.get("/concerns")
@admin_required
def list_concerns():
    concerns = SkinConcern.query.order_by(SkinConcern.name).all()
    return jsonify([c.to_dict() for c in concerns]), 200


@admin_bp.post("/concerns")
@admin_required
def create_concern():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("slug"):
        return jsonify({"error": "name and slug are required"}), 400
    concern = SkinConcern(name=data["name"], slug=data["slug"], description=data.get("description"))
    db.session.add(concern)
    db.session.commit()
    return jsonify(concern.to_dict()), 201


@admin_bp.delete("/concerns/<concern_id>")
@admin_required
def delete_concern(concern_id):
    concern = SkinConcern.query.get_or_404(concern_id)
    db.session.delete(concern)
    db.session.commit()
    return "", 204


# ---------- Products ----------

@admin_bp.get("/products")
@admin_required
def list_products():
    products = Product.query.order_by(Product.created_at.desc()).all()
    return jsonify([p.to_dict() for p in products]), 200


@admin_bp.post("/products")
@admin_required
def create_product():
    data = request.get_json(silent=True) or {}
    required = ["name", "slug", "step_type", "price_cents"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400
    if data["step_type"] not in Product.STEP_TYPES:
        return jsonify({"error": f"step_type must be one of {Product.STEP_TYPES}"}), 400

    product = Product(
        name=data["name"],
        slug=data["slug"],
        step_type=data["step_type"],
        short_description=data.get("short_description"),
        description=data.get("description"),
        key_actives=data.get("key_actives"),
        price_cents=data["price_cents"],
        currency=data.get("currency", "KES"),
        stock_quantity=data.get("stock_quantity", 0),
        cloudinary_public_id=data.get("cloudinary_public_id"),
        is_active=data.get("is_active", True),
    )

    concern_ids = data.get("skin_concern_ids", [])
    if concern_ids:
        product.skin_concerns = SkinConcern.query.filter(SkinConcern.id.in_(concern_ids)).all()

    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@admin_bp.patch("/products/<product_id>")
@admin_required
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}

    for field in [
        "name", "slug", "step_type", "short_description", "description",
        "key_actives", "price_cents", "currency", "stock_quantity",
        "cloudinary_public_id", "is_active",
    ]:
        if field in data:
            setattr(product, field, data[field])

    if "skin_concern_ids" in data:
        product.skin_concerns = SkinConcern.query.filter(
            SkinConcern.id.in_(data["skin_concern_ids"])
        ).all()

    db.session.commit()
    return jsonify(product.to_dict()), 200


@admin_bp.delete("/products/<product_id>")
@admin_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return "", 204


# ---------- Routines ----------

@admin_bp.get("/routines")
@admin_required
def list_routines():
    routines = Routine.query.order_by(Routine.created_at.desc()).all()
    return jsonify([r.to_dict() for r in routines]), 200


@admin_bp.post("/routines")
@admin_required
def create_routine():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("slug"):
        return jsonify({"error": "name and slug are required"}), 400

    routine = Routine(
        name=data["name"],
        slug=data["slug"],
        tagline=data.get("tagline"),
        description=data.get("description"),
        primary_concern_id=data.get("primary_concern_id"),
        cloudinary_public_id=data.get("cloudinary_public_id"),
        bundle_discount_percent=data.get("bundle_discount_percent", 0),
        is_active=data.get("is_active", True),
    )
    db.session.add(routine)
    db.session.commit()
    return jsonify(routine.to_dict()), 201


@admin_bp.patch("/routines/<routine_id>")
@admin_required
def update_routine(routine_id):
    routine = Routine.query.get_or_404(routine_id)
    data = request.get_json(silent=True) or {}

    for field in [
        "name", "slug", "tagline", "description", "primary_concern_id",
        "cloudinary_public_id", "bundle_discount_percent", "is_active",
    ]:
        if field in data:
            setattr(routine, field, data[field])

    db.session.commit()
    return jsonify(routine.to_dict()), 200


@admin_bp.delete("/routines/<routine_id>")
@admin_required
def delete_routine(routine_id):
    routine = Routine.query.get_or_404(routine_id)
    db.session.delete(routine)
    db.session.commit()
    return "", 204


@admin_bp.put("/routines/<routine_id>/steps")
@admin_required
def set_routine_steps(routine_id):
    """Replaces the full ordered step list in one call.

    Body: { "steps": [{ "product_id": "...", "order_index": 1, "time_of_day": "both" }, ...] }
    """
    routine = Routine.query.get_or_404(routine_id)
    data = request.get_json(silent=True) or {}
    steps_data = data.get("steps")
    if not isinstance(steps_data, list) or not steps_data:
        return jsonify({"error": "steps must be a non-empty list"}), 400

    RoutineStep.query.filter_by(routine_id=routine.id).delete()
    for step in steps_data:
        db.session.add(
            RoutineStep(
                routine_id=routine.id,
                product_id=step["product_id"],
                order_index=step["order_index"],
                time_of_day=step.get("time_of_day", "both"),
            )
        )
    db.session.commit()
    return jsonify(routine.to_dict()), 200


# ---------- Image upload ----------

@admin_bp.post("/upload-image")
@admin_required
def upload_product_image():
    """Multipart form upload -- send the file under the "file" field.

    Optional "folder" form field routes the upload into a different
    Cloudinary folder (e.g. delivery-proof photos vs product photography).
    """
    if "file" not in request.files:
        return jsonify({"error": "no file provided"}), 400
    folder = request.form.get("folder", "derma-skincare/products")
    result = upload_image(request.files["file"], folder=folder)
    return jsonify(result), 201


@admin_bp.delete("/upload-image/<path:public_id>")
@admin_required
def remove_image(public_id):
    delete_image(public_id)
    return "", 204


# ---------- Orders ----------

@admin_bp.get("/orders")
@admin_required
def list_all_orders():
    query = Order.query
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    orders = query.order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict(include_admin_fields=True) for o in orders]), 200


@admin_bp.get("/orders/<order_id>")
@admin_required
def get_admin_order(order_id):
    order = Order.query.get_or_404(order_id)
    return jsonify(order.to_dict(include_admin_fields=True)), 200


@admin_bp.post("/orders/<order_id>/refresh-payment-status")
@admin_required
def refresh_order_payment_status(order_id):
    """Only meaningful while a payment is in flight -- queries Safaricom's
    live status rather than trusting local state, same rule as cancel_order
    in orders.py."""
    order = Order.query.get_or_404(order_id)

    if order.status != "payment_pending" or not order.mpesa_checkout_request_id:
        return jsonify(order.to_dict(include_admin_fields=True)), 200

    try:
        result = mpesa_service.query_stk_status(order.mpesa_checkout_request_id)
    except Exception:
        return jsonify({
            "error": "Couldn't confirm payment status with M-Pesa right now -- please try again in a moment."
        }), 502

    result_code = result.get("ResultCode")
    if result_code == "0":
        order.status = "paid"
        db.session.commit()
    elif result_code is not None:
        order.status = "payment_failed"
        db.session.commit()

    return jsonify(order.to_dict(include_admin_fields=True)), 200


@admin_bp.post("/orders/<order_id>/advance")
@admin_required
def advance_order(order_id):
    """Body: { "status": "processing"|"shipped"|"delivered", "delivery_proof_public_id": "..." }

    Only moves an order exactly one step forward in
    paid -> processing -> shipped -> delivered. Advancing to "delivered"
    requires a proof-of-delivery photo already uploaded via
    POST /admin/upload-image.
    """
    order = Order.query.get_or_404(order_id)
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if not can_advance(order.status, new_status):
        return jsonify({
            "error": f"cannot advance an order from '{order.status}' to '{new_status}'"
        }), 400

    if new_status == "delivered":
        proof_id = data.get("delivery_proof_public_id")
        if not proof_id:
            return jsonify({"error": "delivery_proof_public_id is required to mark an order delivered"}), 400
        order.delivery_proof_public_id = proof_id

    order.status = new_status
    db.session.commit()
    return jsonify(order.to_dict(include_admin_fields=True)), 200


@admin_bp.post("/orders/<order_id>/cancel")
@admin_required
def cancel_order_admin(order_id):
    order = Order.query.get_or_404(order_id)

    if not can_cancel(order.status):
        return jsonify({
            "error": f"orders with status '{order.status}' cannot be cancelled"
        }), 400

    order.status = "cancelled"
    db.session.commit()
    return jsonify(order.to_dict(include_admin_fields=True)), 200


# ---------- Users ----------

def _user_admin_dict(user):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat(),
        "order_count": user.orders.count(),
    }


@admin_bp.get("/users")
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([_user_admin_dict(u) for u in users]), 200


@admin_bp.patch("/users/<user_id>")
@admin_required
def update_user_admin_status(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    if "is_admin" not in data:
        return jsonify({"error": "is_admin is required"}), 400

    if user.id == get_jwt_identity() and data["is_admin"] is False:
        return jsonify({"error": "you cannot remove your own admin access"}), 400

    user.is_admin = bool(data["is_admin"])
    db.session.commit()
    return jsonify(_user_admin_dict(user)), 200
