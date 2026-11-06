from flask import Blueprint, current_app, jsonify, request
from sib_api_v3_sdk.rest import ApiException

from app.services import newsletter_service

newsletter_bp = Blueprint("newsletter", __name__)


@newsletter_bp.post("/subscribe")
def subscribe():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    full_name = (data.get("full_name") or "").strip()

    if not email or not newsletter_service.EMAIL_RE.match(email):
        return jsonify({"error": "enter a valid email address"}), 400

    try:
        newsletter_service.subscribe(email, full_name)
    except newsletter_service.NewsletterNotConfigured:
        current_app.logger.warning("Newsletter signup attempted but BREVO_NEWSLETTER_LIST_ID is not set")
        return jsonify({"error": "newsletter signup isn't configured yet -- please try again later"}), 503
    except ApiException as e:
        current_app.logger.error("Brevo newsletter signup failed: %s %s", e.status, e.body)
        return jsonify({"error": "couldn't sign you up right now -- please try again"}), 502
    except Exception:  # noqa: BLE001
        current_app.logger.exception("newsletter signup failed")
        return jsonify({"error": "couldn't sign you up right now -- please try again"}), 502

    return jsonify({"subscribed": True}), 200
