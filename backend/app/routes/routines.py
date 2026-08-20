from flask import Blueprint, request, jsonify

from app.models.routine import Routine
from app.models.product import SkinConcern

routines_bp = Blueprint("routines", __name__)


@routines_bp.get("")
def list_routines():
    routines = Routine.query.filter_by(is_active=True).order_by(Routine.name).all()
    return jsonify([r.to_dict() for r in routines]), 200


@routines_bp.post("/quiz")
def quiz_recommendation():
    """Body: { "concern_slug": "hyperpigmentation" }"""
    data = request.get_json(silent=True) or {}
    concern_slug = data.get("concern_slug")
    if not concern_slug:
        return jsonify({"error": "concern_slug is required"}), 400

    concern = SkinConcern.query.filter_by(slug=concern_slug).first()
    if not concern:
        return jsonify({"error": "unknown concern"}), 404

    routine = Routine.query.filter_by(primary_concern_id=concern.id, is_active=True).first()
    if not routine:
        return jsonify({"error": "no routine found for this concern yet"}), 404

    return jsonify(routine.to_dict()), 200


@routines_bp.get("/<slug>")
def get_routine(slug):
    routine = Routine.query.filter_by(slug=slug, is_active=True).first_or_404()
    return jsonify(routine.to_dict()), 200
