from flask import Blueprint, request, jsonify

from app.models.product import Product, SkinConcern, Ingredient, StepGroup

products_bp = Blueprint("products", __name__)


@products_bp.get("")
def list_products():
    query = Product.query.filter_by(is_active=True)

    step_type = request.args.get("step_type")
    if step_type:
        query = query.filter_by(step_type=step_type)

    concern_slug = request.args.get("concern")
    if concern_slug:
        query = query.join(Product.skin_concerns).filter(SkinConcern.slug == concern_slug)

    ingredient_slug = request.args.get("ingredient")
    if ingredient_slug:
        query = query.join(Product.ingredients).filter(Ingredient.slug == ingredient_slug)

    products = query.order_by(Product.created_at.desc()).all()
    return jsonify([p.to_dict() for p in products]), 200


@products_bp.get("/concerns")
def list_concerns():
    concerns = SkinConcern.query.order_by(SkinConcern.name).all()
    return jsonify([c.to_dict() for c in concerns]), 200


@products_bp.get("/ingredients")
def list_ingredients():
    ingredients = Ingredient.query.order_by(Ingredient.name).all()
    return jsonify([i.to_dict() for i in ingredients]), 200


@products_bp.get("/step-groups")
def list_step_groups():
    groups = StepGroup.query.order_by(StepGroup.position).all()
    return jsonify([g.to_dict() for g in groups]), 200


@products_bp.get("/<slug>")
def get_product(slug):
    product = Product.query.filter_by(slug=slug, is_active=True).first_or_404()
    return jsonify(product.to_dict()), 200
