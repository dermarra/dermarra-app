import re
from datetime import date, datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.hero_slide import HeroSlide
from app.models.inventory import Inventory, InventoryBatch, InventoryTransaction
from app.models.order import Order, OrderItem
from app.models.cart import CartItem
from app.models.wishlist import WishlistItem
from app.models.inventory import InventoryReservation
from app.models.coupon import Coupon
from app.models.product import Product, ProductVariant, ProductImage, SkinConcern, Ingredient, StepGroup
from app.models.routine import Routine, RoutineStep
from app.models.user import User
from app.services import brevo_service, coupon_service, payment_service
from app.services.cloudinary_service import upload_image, delete_image
from app.services import dashboard_service, inventory_service
from app.services.inventory_service import InventoryError, restock_order
from app.utils.decorators import admin_required
from app.utils.order_transitions import can_advance, can_cancel

# Orders in any of these statuses never reached a successful payment, so
# they're excluded from revenue/lifetime-value aggregation.
_UNPAID_STATUSES = ("pending", "payment_pending", "payment_failed", "cancelled")

admin_bp = Blueprint("admin", __name__)


def _commit_or_conflict(message):
    """Commits, turning a unique-constraint clash (duplicate slug/code/SKU)
    into a clear 400 instead of a generic 500. Returns an error response
    tuple, or None on success."""
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": message}), 400
    return None


_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _slug_error(data):
    """Slugs become URLs (/shop/<slug>, /shop/concern/<slug>...). Admins were
    typing descriptive text into the slug box ("wrinkles, ageing, ") which
    produced broken links -- only lowercase words joined by hyphens pass."""
    if "slug" not in data:
        return None
    slug = data.get("slug") or ""
    if not _SLUG_RE.match(slug):
        return (
            f"slug {slug!r} isn't valid -- use lowercase letters and numbers joined by hyphens, "
            "e.g. anti-ageing-serum (it becomes the page URL)"
        )
    return None


def _delete_image_quietly(public_id):
    """Cloudinary cleanup runs only *after* the DB delete committed (it used
    to run first, so a failed delete still lost the image). A Cloudinary
    hiccup here just leaves an orphaned file, never a broken row."""
    if not public_id:
        return
    try:
        delete_image(public_id)
    except Exception:
        pass


def _int_field(data, field, *, minimum=None, maximum=None, multiple_of=None, required=False, label=None):
    """Validates an optional/required integer body field. Returns (value, error)."""
    label = label or field
    if field not in data or data[field] is None or data[field] == "":
        return (None, f"{label} is required") if required else (None, None)
    value = data[field]
    if isinstance(value, bool) or not isinstance(value, int):
        if isinstance(value, float) and value.is_integer():
            value = int(value)
        else:
            return None, f"{label} must be a whole number"
    if minimum is not None and value < minimum:
        return None, f"{label} must be at least {minimum}"
    if maximum is not None and value > maximum:
        return None, f"{label} must be at most {maximum}"
    if multiple_of and value % multiple_of:
        return None, f"{label} must be a whole number of shillings"
    return value, None


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
    if _slug_error(data):
        return jsonify({"error": _slug_error(data)}), 400
    concern = SkinConcern(
        name=data["name"],
        slug=data["slug"],
        description=data.get("description"),
        cloudinary_public_id=data.get("cloudinary_public_id"),
    )
    db.session.add(concern)
    error = _commit_or_conflict("a concern with this name or slug already exists")
    if error:
        return error
    return jsonify(concern.to_dict()), 201


@admin_bp.patch("/concerns/<concern_id>")
@admin_required
def update_concern(concern_id):
    concern = SkinConcern.query.get_or_404(concern_id)
    data = request.get_json(silent=True) or {}
    if _slug_error(data):
        return jsonify({"error": _slug_error(data)}), 400
    for field in ("name", "slug", "description", "cloudinary_public_id"):
        if field in data:
            setattr(concern, field, data[field])
    error = _commit_or_conflict("a concern with this name or slug already exists")
    if error:
        return error
    return jsonify(concern.to_dict()), 200


@admin_bp.delete("/concerns/<concern_id>")
@admin_required
def delete_concern(concern_id):
    concern = SkinConcern.query.get_or_404(concern_id)
    routines = Routine.query.filter_by(primary_concern_id=concern.id).all()
    if routines:
        names = ", ".join(r.name for r in routines)
        return jsonify({
            "error": f"this concern is the primary concern of: {names} -- reassign those routines first"
        }), 400
    image_id = concern.cloudinary_public_id
    db.session.delete(concern)  # product tag links (product_concerns) are removed with it
    db.session.commit()
    _delete_image_quietly(image_id)
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
    if _slug_error(data):
        return jsonify({"error": _slug_error(data)}), 400
    ingredient = Ingredient(
        name=data["name"],
        slug=data["slug"],
        description=data.get("description"),
        cloudinary_public_id=data.get("cloudinary_public_id"),
    )
    db.session.add(ingredient)
    error = _commit_or_conflict("an ingredient with this name or slug already exists")
    if error:
        return error
    return jsonify(ingredient.to_dict()), 201


@admin_bp.patch("/ingredients/<ingredient_id>")
@admin_required
def update_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    data = request.get_json(silent=True) or {}
    if _slug_error(data):
        return jsonify({"error": _slug_error(data)}), 400
    for field in ("name", "slug", "description", "cloudinary_public_id"):
        if field in data:
            setattr(ingredient, field, data[field])
    error = _commit_or_conflict("an ingredient with this name or slug already exists")
    if error:
        return error
    return jsonify(ingredient.to_dict()), 200


@admin_bp.delete("/ingredients/<ingredient_id>")
@admin_required
def delete_ingredient(ingredient_id):
    ingredient = Ingredient.query.get_or_404(ingredient_id)
    image_id = ingredient.cloudinary_public_id
    db.session.delete(ingredient)  # product tag links (product_ingredients) are removed with it
    db.session.commit()
    _delete_image_quietly(image_id)
    return "", 204


# ---------- Coupons ----------

def _validate_coupon_values(data, discount_type):
    """Returns an error string or None. percent: 1-100; fixed_cents: a
    positive whole-shilling amount. max_uses: positive or null."""
    if "discount_value" in data:
        if discount_type == "percent":
            _, error = _int_field(data, "discount_value", minimum=1, maximum=100, required=True,
                                  label="percent discount")
        else:
            _, error = _int_field(data, "discount_value", minimum=100, multiple_of=100, required=True,
                                  label="fixed discount (cents)")
        if error:
            return error
    if "max_uses" in data:
        _, error = _int_field(data, "max_uses", minimum=1)
        if error:
            return error
    return None


@admin_bp.get("/coupons")
@admin_required
def list_coupons():
    coupons = Coupon.query.order_by(Coupon.created_at.desc()).all()
    return jsonify([c.to_dict(include_admin_fields=True) for c in coupons]), 200


@admin_bp.post("/coupons")
@admin_required
def create_coupon():
    data = request.get_json(silent=True) or {}
    required = ["code", "discount_type", "discount_value"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400
    if data["discount_type"] not in Coupon.DISCOUNT_TYPES:
        return jsonify({"error": f"discount_type must be one of {Coupon.DISCOUNT_TYPES}"}), 400
    error = _validate_coupon_values(data, data["discount_type"])
    if error:
        return jsonify({"error": error}), 400
    if not str(data["code"]).strip():
        return jsonify({"error": "code is required"}), 400

    try:
        expires_at = _parse_datetime(data.get("expires_at"))
    except InventoryError as e:
        return jsonify({"error": str(e)}), 400

    coupon = Coupon(
        code=data["code"].strip().upper(),
        discount_type=data["discount_type"],
        discount_value=data["discount_value"],
        is_active=data.get("is_active", True),
        max_uses=data.get("max_uses"),
        first_order_only=data.get("first_order_only", False),
        expires_at=expires_at,
    )
    db.session.add(coupon)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "a coupon with this code already exists"}), 400
    return jsonify(coupon.to_dict(include_admin_fields=True)), 201


@admin_bp.patch("/coupons/<coupon_id>")
@admin_required
def update_coupon(coupon_id):
    coupon = Coupon.query.get_or_404(coupon_id)
    data = request.get_json(silent=True) or {}

    if "discount_type" in data and data["discount_type"] not in Coupon.DISCOUNT_TYPES:
        return jsonify({"error": f"discount_type must be one of {Coupon.DISCOUNT_TYPES}"}), 400
    new_type = data.get("discount_type", coupon.discount_type)
    if "discount_type" in data and "discount_value" not in data:
        data["discount_value"] = coupon.discount_value  # re-check the old value under the new type
    error = _validate_coupon_values(data, new_type)
    if error:
        return jsonify({"error": error}), 400

    if "code" in data:
        coupon.code = data["code"].strip().upper()
    for field in ("discount_type", "discount_value", "is_active", "max_uses", "first_order_only"):
        if field in data:
            setattr(coupon, field, data[field])
    if "expires_at" in data:
        try:
            coupon.expires_at = _parse_datetime(data["expires_at"])
        except InventoryError as e:
            return jsonify({"error": str(e)}), 400

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "a coupon with this code already exists"}), 400
    return jsonify(coupon.to_dict(include_admin_fields=True)), 200


@admin_bp.delete("/coupons/<coupon_id>")
@admin_required
def delete_coupon(coupon_id):
    coupon = Coupon.query.get_or_404(coupon_id)
    coupon.is_active = False
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
    image_id = slide.cloudinary_public_id
    db.session.delete(slide)
    db.session.commit()
    _delete_image_quietly(image_id)
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


def _variant_admin_dict(variant):
    data = variant.to_dict(include_admin_fields=True)
    data["product_name"] = variant.product.name
    data["product_id"] = variant.product_id
    return data


@admin_bp.get("/inventory")
@admin_required
def list_inventory():
    """Optional ?status=in_stock|low_stock|out_of_stock filter.

    Rows are per size (variant). A product with no sizes at all has nothing
    to stock and can't be sold, so it's listed too, as stock_status
    "no_sizes" (included under out_of_stock) -- otherwise it was invisible
    here and admins couldn't tell why it never showed in the shop."""
    status_filter = request.args.get("status")
    variants = ProductVariant.query.join(ProductVariant.product).order_by(Product.name, ProductVariant.position).all()
    rows = [_variant_admin_dict(v) for v in variants]
    rows += [
        {
            "id": None,
            "product_id": p.id,
            "product_name": p.name,
            "label": None,
            "is_active": p.is_active,
            "stock_status": "no_sizes",
        }
        for p in Product.query.filter(~Product.variants.any()).order_by(Product.name).all()
    ]
    if status_filter:
        wanted = {status_filter, "no_sizes"} if status_filter == "out_of_stock" else {status_filter}
        rows = [r for r in rows if r["stock_status"] in wanted]
    return jsonify(rows), 200


@admin_bp.get("/inventory/low-stock")
@admin_required
def low_stock_products():
    variants = (
        ProductVariant.query.join(ProductVariant.product)
        .filter(ProductVariant.is_active.is_(True), Product.is_active.is_(True))
        .order_by(Product.name, ProductVariant.position)
        .all()
    )
    rows = [_variant_admin_dict(v) for v in variants]
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
        variant = ProductVariant.query.get(batch.variant_id)
        data["product_name"] = variant.product.name if variant else None
        data["variant_label"] = variant.label if variant else None
        result.append(data)
    return jsonify(result), 200


@admin_bp.get("/inventory/<variant_id>")
@admin_required
def get_inventory_detail(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)
    batches = (
        InventoryBatch.query
        .filter_by(variant_id=variant_id)
        .order_by(InventoryBatch.expiry_date.asc().nullslast(), InventoryBatch.produced_at.asc())
        .all()
    )
    transactions = (
        InventoryTransaction.query
        .filter_by(variant_id=variant_id)
        .order_by(InventoryTransaction.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify({
        "variant": _variant_admin_dict(variant),
        "batches": [b.to_dict() for b in batches],
        "transactions": [t.to_dict() for t in transactions],
    }), 200


@admin_bp.post("/inventory/<variant_id>/receive")
@admin_required
def receive_stock(variant_id):
    """Logs a finished in-house production run into inventory.

    Body: { "batch_number", "quantity_produced", "unit_cost_cents"?,
            "expiry_date"?, "produced_at"?, "notes"? }
    """
    ProductVariant.query.get_or_404(variant_id)
    data = request.get_json(silent=True) or {}

    try:
        batch, txn = inventory_service.record_production_run(
            variant_id,
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
        return jsonify({"error": "a batch with this batch_number already exists for this variant"}), 400

    db.session.commit()
    return jsonify({"batch": batch.to_dict(), "transaction": txn.to_dict()}), 201


@admin_bp.post("/inventory/<variant_id>/adjust")
@admin_required
def adjust_stock(variant_id):
    """A manual correction against one batch -- always requires a reason.

    Body: { "batch_id", "type" (one of DAMAGE/EXPIRY/LOSS/ADJUSTMENT/
            SAMPLE/PROMOTION/INTERNAL_USE), "quantity", "reason" }
    """
    ProductVariant.query.get_or_404(variant_id)
    data = request.get_json(silent=True) or {}

    try:
        txn = inventory_service.adjust_stock(
            variant_id,
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
    closed = payment_service.expire_abandoned_orders()
    db.session.commit()
    return jsonify({"released": released, "orders_closed": closed}), 200


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
    required = ["name", "slug", "step_type"]
    missing = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400
    if data["step_type"] not in Product.STEP_TYPES:
        return jsonify({"error": f"step_type must be one of {Product.STEP_TYPES}"}), 400
    if not str(data["name"]).strip() or not str(data["slug"]).strip():
        return jsonify({"error": "name and slug can't be empty"}), 400
    if _slug_error(data):
        return jsonify({"error": _slug_error(data)}), 400

    product = Product(
        name=data["name"],
        slug=data["slug"],
        step_type=data["step_type"],
        short_description=data.get("short_description"),
        description=data.get("description"),
        key_actives=data.get("key_actives"),
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
    error = _commit_or_conflict("a product with this slug already exists")
    if error:
        return error
    return jsonify(product.to_dict(include_admin_fields=True)), 201


@admin_bp.patch("/products/<product_id>")
@admin_required
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}
    if "step_type" in data and data["step_type"] not in Product.STEP_TYPES:
        return jsonify({"error": f"step_type must be one of {Product.STEP_TYPES}"}), 400
    if _slug_error(data):
        return jsonify({"error": _slug_error(data)}), 400

    for field in [
        "name", "slug", "step_type", "short_description", "description",
        "key_actives", "cloudinary_public_id", "is_active",
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

    error = _commit_or_conflict("a product with this slug already exists")
    if error:
        return error
    return jsonify(product.to_dict(include_admin_fields=True)), 200


@admin_bp.delete("/products/<product_id>")
@admin_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)

    variant_ids = [v.id for v in product.variants]
    has_inventory_history = (
        variant_ids
        and InventoryTransaction.query.filter(InventoryTransaction.variant_id.in_(variant_ids)).first() is not None
    )
    if has_inventory_history:
        return jsonify({
            "error": "this product has inventory history and can't be deleted -- set is_active to false instead"
        }), 400
    blocker = _variant_delete_blocker(variant_ids) or (
        "this product appears in past orders -- deactivate it instead"
        if OrderItem.query.filter_by(product_id=product.id).first() else None
    )
    if blocker:
        return jsonify({"error": blocker}), 400

    image_ids = [img.cloudinary_public_id for img in product.images]
    if variant_ids:
        CartItem.query.filter(CartItem.variant_id.in_(variant_ids)).delete(synchronize_session=False)
        Inventory.query.filter(Inventory.variant_id.in_(variant_ids)).delete(synchronize_session=False)
    WishlistItem.query.filter_by(product_id=product.id).delete(synchronize_session=False)
    db.session.delete(product)  # cascades to ProductVariant/ProductImage rows
    db.session.commit()
    for image_id in image_ids:
        _delete_image_quietly(image_id)
    return "", 204


def _variant_delete_blocker(variant_ids):
    """Why these variants can't be hard-deleted (still referenced by a
    routine, an order or a stock hold), or None. Carts are fine -- those
    lines are simply dropped."""
    if not variant_ids:
        return None
    steps = RoutineStep.query.filter(RoutineStep.variant_id.in_(variant_ids)).all()
    if steps:
        names = ", ".join(sorted({s.routine.name for s in steps}))
        return f"used in routine(s): {names} -- change those routine steps first, or deactivate instead"
    if OrderItem.query.filter(OrderItem.variant_id.in_(variant_ids)).first():
        return "appears in past orders -- deactivate it instead"
    if InventoryReservation.query.filter(InventoryReservation.variant_id.in_(variant_ids)).first():
        return "has stock reservations from orders -- deactivate it instead"
    return None


# ---------- Product variants ----------

@admin_bp.post("/products/<product_id>/variants")
@admin_required
def create_product_variant(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(silent=True) or {}
    required = ["label", "sku", "price_cents"]
    missing = [f for f in required if not data.get(f) and data.get(f) != 0]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400
    _, error = _int_field(
            data, "price_cents", minimum=100, multiple_of=100, required=True, label="price_cents (KES 1 = 100)"
        )
    if error:
        return jsonify({"error": error}), 400

    variant = ProductVariant(
        product_id=product.id,
        label=data["label"],
        sku=data["sku"],
        price_cents=data["price_cents"],
        currency=data.get("currency", "KES"),
        is_active=data.get("is_active", True),
        position=data.get("position", len(product.variants)),
    )
    db.session.add(variant)
    db.session.flush()

    # Every variant gets an Inventory row up front (0 on hand) -- actual
    # stock is logged separately via "receive stock" once a production
    # run exists to back it.
    db.session.add(Inventory(variant_id=variant.id, reorder_level=data.get("reorder_level", 10)))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "a variant with this SKU already exists"}), 400
    return jsonify(_variant_admin_dict(variant)), 201


@admin_bp.patch("/products/<product_id>/variants/<variant_id>")
@admin_required
def update_product_variant(product_id, variant_id):
    variant = ProductVariant.query.filter_by(id=variant_id, product_id=product_id).first_or_404()
    data = request.get_json(silent=True) or {}
    if "price_cents" in data:
        _, error = _int_field(
            data, "price_cents", minimum=100, multiple_of=100, required=True, label="price_cents (KES 1 = 100)"
        )
        if error:
            return jsonify({"error": error}), 400
    for field in ("label", "sku"):
        if field in data and not str(data[field] or "").strip():
            return jsonify({"error": f"{field} can't be empty"}), 400

    for field in ["label", "sku", "price_cents", "currency", "is_active", "position"]:
        if field in data:
            setattr(variant, field, data[field])

    if "reorder_level" in data:
        inv = Inventory.query.filter_by(variant_id=variant.id).first()
        if inv:
            inv.reorder_level = data["reorder_level"]

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "a variant with this SKU already exists"}), 400
    return jsonify(_variant_admin_dict(variant)), 200


@admin_bp.delete("/products/<product_id>/variants/<variant_id>")
@admin_required
def delete_product_variant(product_id, variant_id):
    variant = ProductVariant.query.filter_by(id=variant_id, product_id=product_id).first_or_404()

    has_inventory_history = InventoryTransaction.query.filter_by(variant_id=variant.id).first() is not None
    if has_inventory_history:
        return jsonify({
            "error": "this variant has inventory history and can't be deleted -- set is_active to false instead"
        }), 400
    blocker = _variant_delete_blocker([variant.id])
    if blocker:
        return jsonify({"error": f"this size is {blocker}"}), 400

    CartItem.query.filter_by(variant_id=variant.id).delete()
    Inventory.query.filter_by(variant_id=variant.id).delete()
    db.session.delete(variant)
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

def _validate_routine_fields(data):
    if _slug_error(data):
        return _slug_error(data)
    _, error = _int_field(data, "bundle_discount_percent", minimum=0, maximum=100, label="bundle discount")
    if error:
        return error
    if data.get("skin_type") and data["skin_type"] not in Routine.SKIN_TYPES:
        return f"skin_type must be one of {Routine.SKIN_TYPES}"
    if data.get("primary_concern_id") and not SkinConcern.query.get(data["primary_concern_id"]):
        return "primary concern not found"
    return None


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
    error = _validate_routine_fields(data)
    if error:
        return jsonify({"error": error}), 400

    routine = Routine(
        name=data["name"],
        slug=data["slug"],
        tagline=data.get("tagline"),
        description=data.get("description"),
        primary_concern_id=data.get("primary_concern_id") or None,
        skin_type=data.get("skin_type") or None,
        cloudinary_public_id=data.get("cloudinary_public_id"),
        bundle_discount_percent=data.get("bundle_discount_percent") or 0,
        is_active=data.get("is_active", True),
    )
    db.session.add(routine)
    error = _commit_or_conflict("a routine with this slug already exists")
    if error:
        return error
    return jsonify(routine.to_dict()), 201


@admin_bp.patch("/routines/<routine_id>")
@admin_required
def update_routine(routine_id):
    routine = Routine.query.get_or_404(routine_id)
    data = request.get_json(silent=True) or {}
    error = _validate_routine_fields(data)
    if error:
        return jsonify({"error": error}), 400

    for field in [
        "name", "slug", "tagline", "description", "primary_concern_id",
        "skin_type", "cloudinary_public_id", "bundle_discount_percent", "is_active",
    ]:
        if field in data:
            value = data[field]
            if field in ("primary_concern_id", "skin_type") and not value:
                value = None
            if field == "bundle_discount_percent" and value in (None, ""):
                value = 0
            setattr(routine, field, value)

    error = _commit_or_conflict("a routine with this slug already exists")
    if error:
        return error
    return jsonify(routine.to_dict()), 200


@admin_bp.delete("/routines/<routine_id>")
@admin_required
def delete_routine(routine_id):
    routine = Routine.query.get_or_404(routine_id)
    if OrderItem.query.filter_by(routine_id=routine.id).first():
        return jsonify({"error": "this routine appears in past orders -- deactivate it instead"}), 400
    image_id = routine.cloudinary_public_id
    CartItem.query.filter_by(routine_id=routine.id).delete(synchronize_session=False)
    db.session.delete(routine)  # steps cascade
    db.session.commit()
    _delete_image_quietly(image_id)
    return "", 204


@admin_bp.put("/routines/<routine_id>/steps")
@admin_required
def set_routine_steps(routine_id):
    """Replaces the full ordered step list in one call.

    Body: { "steps": [{ "variant_id": "...", "order_index": 1, "time_of_day": "both" }, ...] }
    """
    routine = Routine.query.get_or_404(routine_id)
    data = request.get_json(silent=True) or {}
    steps_data = data.get("steps")
    if not isinstance(steps_data, list) or not steps_data:
        return jsonify({"error": "steps must be a non-empty list"}), 400

    for index, step in enumerate(steps_data, start=1):
        if not isinstance(step, dict) or not step.get("variant_id"):
            return jsonify({"error": f"step {index} needs a variant_id"}), 400
        variant = ProductVariant.query.get(step["variant_id"])
        if not variant:
            return jsonify({"error": f"step {index}: product size not found"}), 400
        if not variant.is_active or not variant.product.is_active:
            return jsonify({
                "error": f"step {index}: {variant.product.name} ({variant.label}) is inactive -- "
                         "pick a size that's on sale"
            }), 400
        if step.get("time_of_day", "both") not in ("am", "pm", "both"):
            return jsonify({"error": f"step {index}: time_of_day must be am, pm or both"}), 400

    RoutineStep.query.filter_by(routine_id=routine.id).delete()
    for index, step in enumerate(steps_data, start=1):
        db.session.add(
            RoutineStep(
                routine_id=routine.id,
                variant_id=step["variant_id"],
                order_index=step.get("order_index") or index,
                time_of_day=step.get("time_of_day", "both"),
            )
        )
    db.session.commit()
    db.session.refresh(routine)
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
    if payment_service.expire_abandoned_orders():
        db.session.commit()
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
    return jsonify(_admin_order_detail(order)), 200


def _admin_order_detail(order):
    """Admin order shape plus `stock_allocated`: for a paid-or-later order,
    whether stock was actually deducted. False flags a payment that
    confirmed after its stock had sold out -- needs manual review."""
    data = order.to_dict(include_admin_fields=True)
    data["stock_allocated"] = (
        inventory_service.has_sale_transactions(order)
        if order.status in payment_service.PAID_OR_LATER else None
    )
    return data


@admin_bp.post("/orders/<order_id>/refresh-payment-status")
@admin_required
def refresh_order_payment_status(order_id):
    """Only meaningful while a payment is in flight -- queries Safaricom's
    live status rather than trusting local state, same rule as cancel_order
    in orders.py."""
    order = Order.query.get_or_404(order_id)

    try:
        result = payment_service.check_with_daraja(order, throttle=False)
    except Exception:
        return jsonify({
            "error": "Couldn't confirm payment status with M-Pesa right now -- please try again in a moment."
        }), 502

    if result is not None:
        # Same path as the callback: consumes stock, sets paid_at, emails.
        outcome = payment_service.apply_daraja_result(
            order, result.get("ResultCode"), result_desc=result.get("ResultDesc")
        )
        if outcome:
            db.session.commit()
            if outcome == "paid":
                payment_service.send_paid_email(order)

    return jsonify(_admin_order_detail(order)), 200


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

    if new_status in ("shipped", "delivered") and order.user:
        try:
            brevo_service.send_shipping_update_email(order.user, order)
        except Exception:
            pass

    return jsonify(_admin_order_detail(order)), 200


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
    coupon_service.release_usage(order)
    order.status = "cancelled"
    db.session.commit()
    return jsonify(_admin_order_detail(order)), 200


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
    """?range=today|7d|30d|90d (default 7d). Figures are in Kenyan time;
    see app/services/dashboard_service.py for definitions."""
    if payment_service.expire_abandoned_orders():
        db.session.commit()
    return jsonify(dashboard_service.build_dashboard(request.args.get("range", "7d"))), 200
