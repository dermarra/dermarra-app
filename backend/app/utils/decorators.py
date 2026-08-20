from functools import wraps

from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.user import User


def admin_required(fn):
    """Stack under @jwt_required(). Checks the current user's is_admin flag.

    The first admin has to be bootstrapped by setting is_admin=True directly
    in the database (see backend/README.md) -- after that, admins can
    promote/demote other users via PATCH /api/admin/users/<id>.
    """

    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(get_jwt_identity())
        if not user or not user.is_admin:
            return jsonify({"error": "admin access required"}), 403
        return fn(*args, **kwargs)

    return wrapper
