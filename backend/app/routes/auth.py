from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)

from app.extensions import db
from app.models.user import User
from app.services.brevo_service import send_welcome_email, send_password_reset_email
from app.utils.tokens import generate_password_reset_token, verify_password_reset_token

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not email or not password or not full_name:
        return jsonify({"error": "email, password, and full_name are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "an account with this email already exists"}), 409

    user = User(email=email, full_name=full_name, phone=data.get("phone"))
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    try:
        send_welcome_email(user)
    except Exception:
        pass

    tokens = _issue_tokens(user)
    return jsonify({"user": user.to_dict(), **tokens}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "invalid email or password"}), 401

    tokens = _issue_tokens(user)
    return jsonify({"user": user.to_dict(), **tokens}), 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": access_token}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


_PATCHABLE_FIELDS = (
    "full_name",
    "phone",
    "default_shipping_name",
    "default_shipping_address_line1",
    "default_shipping_address_line2",
    "default_shipping_city",
    "default_shipping_country",
    "default_shipping_postal_code",
    "default_shipping_phone",
)


@auth_bp.patch("/me")
@jwt_required()
def update_me():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    for field in _PATCHABLE_FIELDS:
        if field in data:
            setattr(user, field, data[field])

    db.session.commit()
    return jsonify(user.to_dict()), 200


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not user.check_password(current_password):
        return jsonify({"error": "current password is incorrect"}), 401
    if len(new_password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"success": True}), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        token = generate_password_reset_token(user)
        reset_url = f"{current_app.config['FRONTEND_BASE_URL']}/reset-password?token={token}"
        try:
            send_password_reset_email(user, reset_url)
        except Exception:
            pass

    # Same response whether or not the email exists -- never let this
    # endpoint be used to enumerate registered accounts.
    return jsonify({
        "message": "If an account exists for that email, we've sent a password reset link."
    }), 200


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    new_password = data.get("new_password") or ""

    if len(new_password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400

    user = verify_password_reset_token(token)
    if not user:
        return jsonify({"error": "this reset link is invalid or has expired -- request a new one"}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"success": True}), 200


def _issue_tokens(user):
    return {
        "access_token": create_access_token(identity=user.id),
        "refresh_token": create_refresh_token(identity=user.id),
    }
