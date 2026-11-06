from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.user import User
from app.utils.permissions import has_permission


def _current_admin():
    user = User.query.get(get_jwt_identity())
    if not user or not user.is_admin or not user.admin_role:
        return None
    return user


def admin_required(fn):
    """Any admin (anyone with an admin role). Prefer `permission_required`
    for anything that reads or changes data -- every route in
    app/routes/admin.py uses it.

    The first super admin is bootstrapped with `flask make-super-admin EMAIL`
    (see backend/README.md); after that, super admins assign roles in the
    admin (Users, Roles & access)."""

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = _current_admin()
        if not user:
            return jsonify({"error": "admin access required"}), 403
        g.admin_user = user
        return fn(*args, **kwargs)

    return wrapper


def permission_required(*keys):
    """Admin with ANY of the given permission keys (app/utils/permissions.py).
    403s name the missing permission so the UI can explain it."""

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = _current_admin()
            if not user:
                return jsonify({"error": "admin access required"}), 403
            if not has_permission(user, *keys):
                return (
                    jsonify({"error": "your role doesn't allow this", "code": "forbidden", "needs": list(keys)}),
                    403,
                )
            g.admin_user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator
