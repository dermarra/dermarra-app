from flask import Blueprint, request, jsonify

from app.models.routine import Routine
from app.models.product import SkinConcern
from app.utils.purchasable import unavailable_reason

routines_bp = Blueprint("routines", __name__)


@routines_bp.get("")
def list_routines():
    routines = Routine.query.filter_by(is_active=True).order_by(Routine.name).all()
    return jsonify([r.to_dict() for r in routines if unavailable_reason(None, r) is None]), 200


@routines_bp.post("/quiz")
def quiz_recommendation():
    """Body: { "concern_slug": "hyperpigmentation", "skin_type"?: "oily" }

    Matching precedence -- never refuses a match just because the routine
    catalog isn't fully tagged with skin_type yet:
      1. exact concern + skin_type match
      2. concern match on a skin_type-agnostic routine (skin_type IS NULL)
      3. any active routine for that concern, regardless of skin_type
    """
    data = request.get_json(silent=True) or {}
    concern_slug = data.get("concern_slug")
    skin_type = data.get("skin_type")
    if not concern_slug:
        return jsonify({"error": "concern_slug is required"}), 400

    concern = SkinConcern.query.filter_by(slug=concern_slug).first()
    if not concern:
        return jsonify({"error": "unknown concern"}), 404

    # Only routines a customer can actually buy (active, has steps, every
    # step's size still on sale) are ever recommended.
    candidates = [
        r for r in Routine.query.filter_by(primary_concern_id=concern.id, is_active=True).order_by(Routine.name)
        if unavailable_reason(None, r) is None
    ]

    routine = None
    if skin_type:
        routine = next((r for r in candidates if r.skin_type == skin_type), None)
    if not routine:
        routine = next((r for r in candidates if r.skin_type is None), None)
    if not routine and candidates:
        routine = candidates[0]

    if not routine:
        return jsonify({"error": "no routine found for this concern yet"}), 404

    return jsonify(routine.to_dict()), 200


@routines_bp.get("/<slug>")
def get_routine(slug):
    routine = Routine.query.filter_by(slug=slug, is_active=True).first_or_404()
    return jsonify(routine.to_dict()), 200
