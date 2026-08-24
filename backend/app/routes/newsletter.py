import re

from flask import Blueprint, request, jsonify, current_app
from sib_api_v3_sdk.rest import ApiException

from app.services import brevo_service

newsletter_bp = Blueprint("newsletter", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@newsletter_bp.post("/subscribe")
def subscribe():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    full_name = (data.get("full_name") or "").strip()

    if not email or not _EMAIL_RE.match(email):
        return jsonify({"error": "enter a valid email address"}), 400

    list_id = current_app.config.get("BREVO_NEWSLETTER_LIST_ID")
    if not list_id:
        current_app.logger.warning("Newsletter signup attempted but BREVO_NEWSLETTER_LIST_ID is not set")
        return jsonify({"error": "newsletter signup isn't configured yet -- please try again later"}), 503

    try:
        brevo_service.add_contact_to_list(email, full_name, list_id)
    except ApiException as e:
        # Brevo returns 400 "duplicate_parameter" if this email is already
        # subscribed -- that's a successful outcome from the visitor's
        # point of view, not an error.
        if e.status == 400 and "duplicate" in (e.body or "").lower():
            return jsonify({"subscribed": True}), 200
        return jsonify({"error": "couldn't sign you up right now -- please try again"}), 502
    except Exception:
        return jsonify({"error": "couldn't sign you up right now -- please try again"}), 502

    return jsonify({"subscribed": True}), 200
