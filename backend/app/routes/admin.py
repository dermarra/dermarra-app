from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.hero_slide import HeroSlide
from app.models.inventory import Inventory, InventoryBatch, InventoryTransaction
from app.models.order import Order
from app.models.product import Product, ProductImage, SkinConcern, Ingredient, StepGroup
from app.models.routine import Routine, RoutineStep
from app.models.user import User
from app.services import mpesa_service, brevo_service
from app.services.cloudinary_service import upload_image, delete_image
from app.services import inventory_service
from app.services.inventory_service import InventoryError, restock_order
from app.utils.decorators import admin_required
from app.utils.order_transitions import can_advance, can_cancel

# Orders in any of these statuses never reached a successful payment, so
# they're excluded from revenue/lifetime-value aggregation.
_UNPAID_STATUSES = ("pending", "payment_pending", "payment_failed", "cancelled")

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
    concern = SkinConcern(
        name=data["name"],
        slug=data["slug"],
        description=data.get("description"),
        cloudinary_public_id=data.get("cloudinary_public_id"),
    )
    db.session.add(concern)
    db.session.commit()
    return jsonify(concern.to_dict()), 201


@admin_bp.patch("/concerns/<concern_id>")
@admin_required
def update_concern(concern_id):
    concern = SkinConcern.query.get_or_404(concern_id)
    data = request.get_json(silent=True) or {}
    for field in ("name", "slug", "description", "cloudinary_public_id"):
        if field in data:
            setattr(concern, field, data[field])
    db.session.commit()
    return jsonify(concern.to_dict()), 200


@admin_bp.delete("/concerns/<concern_id>")
@admin_required
def delete_concern(concern_id):
    concern = SkinConcern.query.get_or_404(concern_id)
    if concern.cloudinary_public_id:
        delete_image(concern.cloudinary_public_id)
    db.session.delete(concern)
    db.session.commit()
    return "", 204


# ---------- Ingredients ----------

@admin_bp.get("/ingredients")
@admin_required
def list_ingredients():
    ingredients = Ingredient.query.order_by(Ingredient.name).all()
    return jsonify([i.to_dict() for i in ingredients]), 200


@admin_bp.post("/ingredients")
@admin_required
def create_ingredient():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("slug"):
        return jsonify({"error": "name and slug are required"}), 400
    ingredient = Ingredient(
        name=data["name"],
        slug=data["slug"],
        description=data.get("description"),
        cloudinary_public_id=data.get("cloudinary_public_id"),
    )
    db.session.add(ingredient)
    db.session.commit()
    return jsonify(ingredient.to_dict()), 201


@admin_bp.patch("/ingredients/<ingredient_id>")
@admin_required
def update_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    data = request.get_json(silent=True) or {}
    for field in ("name", "slug", "description", "cloudinary_public_id"):
        if field in data:
            setattr(ingredient, field, data[field])
    db.session.commit()
    return jsonify(ingredient.to_dict()), 200


@admin_bp.delete("/ingredients/<ingredient_id>")
@admin_required
def delete_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    if ingredient.cloudinary_public_id:
        delete_image(ingredient.cloudinary_public_id)
    db.session.delete(ingredient)
    db.session.commit()
    return "", 204


# ---------- Step groups ----------
# Fixed set of 4 rows (prep/treat/seal/protect), seeded by migration --
# edit-only, no create/delete (see StepGroup model docstring).

@admin_bp.get("/step-groups")
@admin_required
def list_step_groups_admin():
    groups = StepGroup.query.order_by(StepGroup.position).all()
    return jsonify([g.to_dict() for g in groups]), 200


@admin_bp.patch("/step-groups/<step_group_id>")
@admin_required
def update_step_group(step_group_id):
    group = StepGroup.query.get_or_404(step_group_id)
    data = request.get_json(silent=True) or {}
    for field in ("label", "description", "cloudinary_public_id"):
        if field in data:
            setattr(group, field, data[field])
    db.session.commit()
    return jsonify(group.to_dict()), 200


# ---------- Hero slides ----------
# Homepage carousel content -- free-standing marketing rows, not tied to
# a specific Product/Routine (cta_link is a free-text path/URL).

@admin_bp.get("/hero-slides")
@admin_required
def list_hero_slides_admin():
    slides = HeroSlide.query.order_by(HeroSlide.position).all()
    return jsonify([s.to_dict() for s in slides]), 200


@admin_bp.post("/hero-slides")
@admin_required
def create_hero_slide():
    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return jsonify({"error": "title is required"}), 400
    slide = HeroSlide(
        eyebrow=data.get("eyebrow"),
        title=data["title"],
        subtitle=data.get("subtitle"),
        cloudinary_public_id=data.get("cloudinary_public_id"),
        cta_label=data.get("cta_label"),
        cta_link=data.get("cta_link"),
        position=data.get("position", 0),
        is_active=data.get("is_active", True),
    )
    db.session.add(slide)
    db.session.commit()
    return jsonify(slide.to_dict()), 201


@admin_bp.patch("/hero-slides/<slide_id>")
@admin_required
def update_hero_slide(slide_id):
    slide = HeroSlide.query.get_or_404(slide_id)
    data = request.get_json(silent=True) or {}
    for field in (
        "eyebrow", "title", "subtitle", "cloudinary_public_id",
        "cta_label", "cta_link", "position", "is_active",
    ):
        if field in data:
            setattr(slide, field, data[field])
    db.session.commit()
    return jsonify(slide.to_dict()), 200


@admin_bp.delete("/hero-slides/<slide_id>")
@admin_required
def delete_hero_slide(slide_id):
    slide = HeroSlide.query.get_or_404(slide_id)
    if slide.cloudinary_public_id:
        delete_image(slide.cloudinary_public_id)
    db.session.delete(slide)
    db.session.commit()
    return "", 204


# ---------- Inventory ----------
# Batch/lot tracking with FEFO allocation, stock reservations, and an
# immutable transaction ledger -- see app/services/inventory_service.py
# and app/models/inventory.py for the mechanics. Customers only ever see
# stock_status via Product.to_dict(); everything here (batches, unit
# cost, the ledger) is admin-only.

def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise InventoryError(f"invalid date: {value!r} (expected YYYY-MM-DD)")


def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise InventoryError(f"invalid datetime: {value!r} (expected ISO 8601)")


@admin_bp.get("/inventory")
@admin_required
def list_inventory():
    """Optional ?status=in_stock|low_stock|out_of_stock filter."""
    status_filter = request.args.get("status")
    products = Product.query.order_by(Product.name).all()
    rows = [p.to_dict(include_concerns=False, include_admin_fields=True) for p in products]
    if status_filter:
        rows = [r for r in rows if r["stock_status"] == status_filter]
    return jsonify(rows), 200


@admin_bp.get("/inventory/low-stock")
@admin_required
def low_stock_products():
    products = Product.query.filter_by(is_active=True).order_by(Product.name).all()
    rows = [p.to_dict(include_concerns=False, include_admin_fields=True) for p in products]
    return jsonify([r for r in rows if r["stock_status"] in ("low_stock", "out_of_stock")]), 200


@admin_bp.get("/inventory/expiring-soon")
@admin_required
def expiring_soon_batches():
    """Optional ?days= (default 30)."""
    try:
        days = int(request.args.get("days", 30))
    except ValueError:
        return jsonify({"error": "days must be an integer"}), 400

    cutoff = date.today() + timedelta(days=days)
    batches = (
        InventoryBatch.query
        .filter(
            InventoryBatch.status == "active",
            InventoryBatch.expiry_date.isnot(None),
            InventoryBatch.expiry_date <= cutoff,
        )
        .order_by(InventoryBatch.expiry_date.asc())
        .all()
    )
    result = []
    for batch in batches:
        data = batch.to_dict()
        product = Product.query.get(batch.product_id)
        data["product_name"] = product.name if product else None
        result.append(data)
    return jsonify(result), 200


@admin_bp.get("/inventory/<product_id>")
@admin_required
def get_inventory_detail(product_id):
    product = Product.query.get_or_404(product_id)
    batches = (
        InventoryBatch.query
        .filter_by(product_id=product_id)
        .order_by(InventoryBatch.expiry_date.asc().nullslast(), InventoryBatch.produced_at.asc())
        .all()
    )
    transactions = (
        InventoryTransaction.query
        .filter_by(product_id=product_id)
        .order_by(InventoryTransaction.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify({
        "product": product.to_dict(include_concerns=False, include_admin_fields=True),
        "batches": [b.to_dict() for b in batches],
        "transactions": [t.to_dict() for t in transactions],
    }), 200


@admin_bp.post("/inventory/<product_id>/receive")
@admin_required
def receive_stock(product_id):
    """Logs a finished in-house production run into inventory.

    Body: { "batch_number", "quantity_produced", "unit_cost_cents"?,
            "expiry_date"?, "produced_at"?, "notes"? }
    """
    Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}

    try:
        batch, txn = inventory_service.record_production_run(
            product_id,
            batch_number=data.get("batch_number"),
            quantity_produced=data.get("quantity_produced"),
            unit_cost_cents=data.get("unit_cost_cents"),
            expiry_date=_parse_date(data.get("expiry_date")),
            produced_at=_parse_datetime(data.get("produced_at")),
            notes=data.get("notes"),
            created_by=get_jwt_identity(),
        )
    except InventoryError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "a batch with this batch_number already exists for this product"}), 400

    db.session.commit()
    return jsonify({"batch": batch.to_dict(), "transaction": txn.to_dict()}), 201


@admin_bp.post("/inventory/<product_id>/adjust")
@admin_required
def adjust_stock(product_id):
    """A manual correction against one batch -- always requires a reason.

    Body: { "batch_id", "type" (one of DAMAGE/EXPIRY/LOSS/ADJUSTMENT/
            SAMPLE/PROMOTION/INTERNAL_USE), "quantity", "reason" }
    """
    Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}

    try:
        txn = inventory_service.adjust_stock(
            product_id,
            batch_id=data.get("batch_id"),
            transaction_type=data.get("type"),
            quantity=data.get("quantity"),
            reason=data.get("reason"),
            created_by=get_jwt_identity(),
        )
    except InventoryError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

    db.session.commit()
    return jsonify(txn.to_dict()), 201


@admin_bp.post("/inventory/expire-reservations")
@admin_required
def expire_reservations():
    """No background worker in this project -- hit this from an external
    cron (or manually) to release reservations nobody paid for in time.
    Also runs lazily whenever a new reservation is created."""
    released = inventory_service.expire_stale_reservations()
    db.session.commit()
    return jsonify({"released": released}), 200


# ---------- Products ----------

@admin_bp.get("/products")
@admin_required
def list_products():
    products = Product.query.order_by(Product.created_at.desc()).all()
    return jsonify([p.to_dict(include_admin_fields=True) for p in products]), 200


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
        cloudinary_public_id=data.get("cloudinary_public_id"),
        is_active=data.get("is_active", True),
    )

    concern_ids = data.get("skin_concern_ids", [])
    if concern_ids:
        product.skin_concerns = SkinConcern.query.filter(SkinConcern.id.in_(concern_ids)).all()

    ingredient_ids = data.get("ingredient_ids", [])
    if ingredient_ids:
        product.ingredients = Ingredient.query.filter(Ingredient.id.in_(ingredient_ids)).all()

    db.session.add(product)
    db.session.flush()

    # Every product gets an Inventory row up front (0 on hand) -- actual
    # stock is logged separately via "receive stock" once a production
    # run exists to back it.
    db.session.add(Inventory(product_id=product.id, reorder_level=data.get("reorder_level", 10)))

    db.session.commit()
    return jsonify(product.to_dict(include_admin_fields=True)), 201


@admin_bp.patch("/products/<product_id>")
@admin_required
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}

    for field in [
        "name", "slug", "step_type", "short_description", "description",
        "key_actives", "price_cents", "currency",
        "cloudinary_public_id", "is_active",
    ]:
        if field in data:
            setattr(product, field, data[field])

    if "skin_concern_ids" in data:
        product.skin_concerns = SkinConcern.query.filter(
            SkinConcern.id.in_(data["skin_concern_ids"])
        ).all()

    if "ingredient_ids" in data:
        product.ingredients = Ingredient.query.filter(
            Ingredient.id.in_(data["ingredient_ids"])
        ).all()

    if "reorder_level" in data:
        inv = Inventory.query.filter_by(product_id=product.id).first()
        if inv:
            inv.reorder_level = data["reorder_level"]

    db.session.commit()
    return jsonify(product.to_dict(include_admin_fields=True)), 200


@admin_bp.delete("/products/<product_id>")
@admin_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)

    has_inventory_history = InventoryTransaction.query.filter_by(product_id=product.id).first() is not None
    if has_inventory_history:
        return jsonify({
            "error": "this product has inventory history and can't be deleted -- set is_active to false instead"
        }), 400

    Inventory.query.filter_by(product_id=product.id).delete()
    db.session.delete(product)
    db.session.commit()
    return "", 204


@admin_bp.post("/products/<product_id>/images")
@admin_required
def add_product_image(product_id):
    """Multipart form upload -- send the file under the "file" field."""
    product = Product.query.get_or_404(product_id)
    if "file" not in request.files:
        return jsonify({"error": "no file provided"}), 400

    result = upload_image(request.files["file"], folder="derma-skincare/products")
    max_position = db.session.query(func.max(ProductImage.position)).filter_by(
        product_id=product.id
    ).scalar()
    is_first = len(product.images) == 0

    image = ProductImage(
        product_id=product.id,
        cloudinary_public_id=result["public_id"],
        position=(max_position + 1) if max_position is not None else 0,
        is_primary=is_first,
    )
    db.session.add(image)
    if is_first:
        product.cloudinary_public_id = result["public_id"]
    db.session.commit()
    return jsonify(image.to_dict()), 201


@admin_bp.patch("/products/<product_id>/images/<image_id>")
@admin_required
def update_product_image(product_id, image_id):
    """Body: { "is_primary"?: bool, "position"?: int }"""
    product = Product.query.get_or_404(product_id)
    image = ProductImage.query.filter_by(id=image_id, product_id=product.id).first_or_404()
    data = request.get_json(silent=True) or {}

    if "position" in data:
        image.position = data["position"]

    if data.get("is_primary") is True:
        for other in product.images:
            if other.id != image.id:
                other.is_primary = False
        image.is_primary = True
        product.cloudinary_public_id = image.cloudinary_public_id

    db.session.commit()
    return jsonify(image.to_dict()), 200


@admin_bp.delete("/products/<product_id>/images/<image_id>")
@admin_required
def delete_product_image(product_id, image_id):
    product = Product.query.get_or_404(product_id)
    image = ProductImage.query.filter_by(id=image_id, product_id=product.id).first_or_404()
    was_primary = image.is_primary

    delete_image(image.cloudinary_public_id)
    db.session.delete(image)
    db.session.flush()

    if was_primary:
        remaining = (
            ProductImage.query.filter_by(product_id=product.id)
            .order_by(ProductImage.position)
            .first()
        )
        if remaining:
            remaining.is_primary = True
            product.cloudinary_public_id = remaining.cloudinary_public_id
        else:
            product.cloudinary_public_id = None

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
        skin_type=data.get("skin_type"),
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
        "skin_type", "cloudinary_public_id", "bundle_discount_percent", "is_active",
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

    if data.get("tracking_number"):
        order.tracking_number = data["tracking_number"]

    order.status = new_status
    db.session.commit()
    return jsonify(order.to_dict(include_admin_fields=True)), 200


@admin_bp.post("/orders/<order_id>/send-invoice")
@admin_required
def send_order_invoice(order_id):
    order = Order.query.get_or_404(order_id)
    if not order.user:
        return jsonify({"error": "this order has no associated user"}), 400

    try:
        brevo_service.send_order_invoice_email(order.user, order)
    except Exception:
        return jsonify({"error": "couldn't send the invoice email right now -- please try again"}), 502

    return jsonify({"sent": True}), 200


@admin_bp.post("/orders/<order_id>/cancel")
@admin_required
def cancel_order_admin(order_id):
    order = Order.query.get_or_404(order_id)

    if not can_cancel(order.status):
        return jsonify({
            "error": f"orders with status '{order.status}' cannot be cancelled"
        }), 400

    # can_cancel only allows paid/processing/shipped, all of which imply
    # stock was already decremented once when the order became paid.
    restock_order(order, created_by=get_jwt_identity())
    order.status = "cancelled"
    db.session.commit()
    return jsonify(order.to_dict(include_admin_fields=True)), 200


# ---------- Users ----------

def _lifetime_value_cents(user):
    return sum(
        order.total_cents for order in user.orders if order.status not in _UNPAID_STATUSES
    )


def _user_admin_dict(user):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat(),
        "order_count": user.orders.count(),
        "lifetime_value_cents": _lifetime_value_cents(user),
    }


@admin_bp.get("/users")
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([_user_admin_dict(u) for u in users]), 200


@admin_bp.get("/users/<user_id>")
@admin_required
def get_user_admin(user_id):
    user = User.query.get_or_404(user_id)
    recent_orders = user.orders.order_by(Order.created_at.desc()).limit(10).all()

    last_shipping_address = None
    last_order_with_address = (
        user.orders.filter(Order.shipping_address_line1.isnot(None))
        .order_by(Order.created_at.desc())
        .first()
    )
    if last_order_with_address:
        last_shipping_address = {
            "name": last_order_with_address.shipping_name,
            "address_line1": last_order_with_address.shipping_address_line1,
            "address_line2": last_order_with_address.shipping_address_line2,
            "city": last_order_with_address.shipping_city,
            "country": last_order_with_address.shipping_country,
            "postal_code": last_order_with_address.shipping_postal_code,
            "phone": last_order_with_address.shipping_phone,
        }

    data = _user_admin_dict(user)
    data["recent_orders"] = [o.to_dict(include_admin_fields=True) for o in recent_orders]
    data["last_shipping_address"] = last_shipping_address
    return jsonify(data), 200


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


# ---------- Dashboard ----------

@admin_bp.get("/dashboard")
@admin_required
def dashboard():
    paid_or_later = Order.query.filter(Order.status.notin_(_UNPAID_STATUSES))

    total_revenue_cents = paid_or_later.with_entities(
        func.coalesce(func.sum(Order.total_cents), 0)
    ).scalar()

    order_counts_by_status = dict(
        db.session.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    )

    stock_summary = inventory_service.inventory_summary()

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    revenue_rows = (
        paid_or_later.filter(Order.paid_at.isnot(None), Order.paid_at >= thirty_days_ago)
        .with_entities(func.date(Order.paid_at).label("day"), func.sum(Order.total_cents))
        .group_by("day")
        .order_by("day")
        .all()
    )
    revenue_by_day = [
        {"date": day.isoformat() if hasattr(day, "isoformat") else str(day), "revenue_cents": revenue}
        for day, revenue in revenue_rows
    ]

    recent_orders = Order.query.order_by(Order.created_at.desc()).limit(10).all()
    recent_activity = [
        {
            "id": o.id,
            "status": o.status,
            "total_cents": o.total_cents,
            "created_at": o.created_at.isoformat(),
            "user_email": o.user.email if o.user else None,
        }
        for o in recent_orders
    ]

    return jsonify({
        "total_revenue_cents": total_revenue_cents,
        "order_counts_by_status": order_counts_by_status,
        "low_stock_count": stock_summary["low_stock_count"],
        "out_of_stock_count": stock_summary["out_of_stock_count"],
        "expiring_soon_count": stock_summary["expiring_soon_count"],
        "total_products": stock_summary["total_products"],
        "revenue_by_day": revenue_by_day,
        "recent_activity": recent_activity,
    }), 200
