from flask import Blueprint, jsonify

from app.models.hero_slide import HeroSlide

hero_bp = Blueprint("hero", __name__)


@hero_bp.get("")
def list_hero_slides():
    slides = HeroSlide.query.filter_by(is_active=True).order_by(HeroSlide.position).all()
    return jsonify([s.to_dict() for s in slides]), 200
