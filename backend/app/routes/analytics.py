"""Shopper visit counting (public ping) and the admin views of it.

POST /api/analytics/ping           {visitor_id, path, new_page, referrer} -> 204
GET  /api/admin/analytics/visits   counts per period + daily chart (dashboard.view)
GET  /api/admin/presence           staff with last seen / active now (dashboard.view)
"""
from urllib.parse import urlparse

from flask import Blueprint, current_app, jsonify, request

from app.models.user import User
from app.routes.admin import admin_bp
from app.services import analytics_service
from app.utils.decorators import permission_required

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.post("/ping")
def ping():
    data = request.get_json(silent=True) or {}
    own_host = (urlparse(current_app.config.get("FRONTEND_BASE_URL") or "").hostname or "dermarra.com").lower()
    try:
        analytics_service.record_ping(
            visitor_id=str(data.get("visitor_id") or "").lower(),
            path=str(data.get("path") or "/"),
            new_page=data.get("new_page") is True,
            user_agent=request.headers.get("User-Agent", ""),
            referrer=str(data.get("referrer") or ""),
            own_host=own_host.removeprefix("www."),
        )
    except Exception:  # noqa: BLE001 -- counting must never error for a shopper
        current_app.logger.exception("visit ping failed")
    return "", 204


@admin_bp.get("/analytics/visits")
@permission_required("dashboard.view")
def visit_stats():
    try:
        days = max(7, min(int(request.args.get("days", 30)), 365))
    except ValueError:
        days = 30
    return jsonify(analytics_service.visit_summary(days=days)), 200


@admin_bp.get("/presence")
@permission_required("dashboard.view")
def staff_presence():
    staff = User.query.filter(User.is_admin.is_(True)).all()
    return jsonify(analytics_service.staff_presence(staff)), 200
