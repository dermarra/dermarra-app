"""Roles & access and the activity log -- registered on the admin blueprint
(so the activity hook in app/routes/admin.py records changes here too).

GET    /api/admin/permissions            the permission catalogue (for the role editor)
GET    /api/admin/roles                  roles with member counts
POST   /api/admin/roles                  create a role
PATCH  /api/admin/roles/<id>             edit name/description/permissions (not the super-admin role)
DELETE /api/admin/roles/<id>             delete a role nobody has (not the super-admin role)
GET    /api/admin/activity               ?actor=<user id>&area=<orders|catalogue|...>&before=<iso>&limit=
"""
import re
import uuid
from datetime import datetime

import click
from flask import g, jsonify, request

from app.extensions import db
from app.models.admin_role import AdminActivity, AdminRole
from app.models.user import User
from app.routes.admin import admin_bp
from app.utils.decorators import permission_required
from app.utils.permissions import PERMISSIONS, clean_permissions

_KEY_RE = re.compile(r"[^a-z0-9]+")


def _role_key(name):
    return _KEY_RE.sub("_", name.strip().lower()).strip("_")[:60] or "role"


@admin_bp.get("/permissions")
@permission_required("roles.manage")
def list_permissions():
    items = [
        {"key": k, "group": grp, "label": label, "help": help_}
        for k, (grp, label, help_) in PERMISSIONS.items()
    ]
    return jsonify(items), 200


@admin_bp.get("/roles")
@permission_required("roles.manage", "users.view")
def list_roles():
    roles = AdminRole.query.order_by(AdminRole.is_super.desc(), AdminRole.name).all()
    return jsonify([r.to_dict(include_counts=True) for r in roles]), 200


def _apply_role_fields(role, data):
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return "a role needs a name"
        clash = AdminRole.query.filter(db.func.lower(AdminRole.name) == name.lower(), AdminRole.id != role.id).first()
        if clash:
            return f"there's already a role called {clash.name}"
        role.name = name[:120]
    if "description" in data:
        role.description = (data.get("description") or "").strip() or None
    if "permissions" in data:
        perms = clean_permissions(data.get("permissions"))
        if not perms:
            return "tick at least one permission"
        role.permissions = perms
    return None


@admin_bp.post("/roles")
@permission_required("roles.manage")
def create_role():
    data = request.get_json(silent=True) or {}
    role = AdminRole(id=str(uuid.uuid4()), permissions=[], is_super=False)
    err = _apply_role_fields(role, {**data, "name": data.get("name"), "permissions": data.get("permissions")})
    if err:
        return jsonify({"error": err}), 400
    base = _role_key(role.name)
    key, n = base, 2
    while AdminRole.query.filter_by(key=key).first():
        key, n = f"{base}_{n}", n + 1
    role.key = key
    db.session.add(role)
    g.activity_summary = f"Created the {role.name} role"
    db.session.commit()
    return jsonify(role.to_dict(include_counts=True)), 201


@admin_bp.patch("/roles/<role_id>")
@permission_required("roles.manage")
def update_role(role_id):
    role = AdminRole.query.get_or_404(role_id)
    if role.is_super:
        return jsonify({"error": "the super-admin role always has every permission and can't be edited"}), 400
    err = _apply_role_fields(role, request.get_json(silent=True) or {})
    if err:
        return jsonify({"error": err}), 400
    g.activity_summary = f"Edited the {role.name} role"
    db.session.commit()
    return jsonify(role.to_dict(include_counts=True)), 200


@admin_bp.delete("/roles/<role_id>")
@permission_required("roles.manage")
def delete_role(role_id):
    role = AdminRole.query.get_or_404(role_id)
    if role.is_super:
        return jsonify({"error": "the super-admin role can't be deleted"}), 400
    members = role.members.filter(User.is_admin.is_(True)).count()
    if members:
        who = "1 person has" if members == 1 else f"{members} people have"
        return jsonify({"error": f"{who} this role -- move them first"}), 400
    g.activity_summary = f"Deleted the {role.name} role"
    db.session.delete(role)
    db.session.commit()
    return "", 204


@admin_bp.get("/activity")
@permission_required("activity.view")
def list_activity():
    q = AdminActivity.query
    if request.args.get("actor"):
        q = q.filter(AdminActivity.actor_id == request.args["actor"])
    if request.args.get("area"):
        q = q.filter(AdminActivity.action.like(f"{request.args['area']}.%"))
    if request.args.get("before"):
        try:
            q = q.filter(AdminActivity.created_at < datetime.fromisoformat(request.args["before"]))
        except ValueError:
            return jsonify({"error": "before must be an ISO date-time"}), 400
    try:
        limit = max(1, min(int(request.args.get("limit", 50)), 200))
    except ValueError:
        limit = 50
    rows = q.order_by(AdminActivity.created_at.desc()).limit(limit + 1).all()
    return jsonify({"items": [r.to_dict() for r in rows[:limit]], "has_more": len(rows) > limit}), 200


def register_cli(app):
    @app.cli.command("make-super-admin")
    @click.argument("email")
    def make_super_admin(email):
        """Give EMAIL the super-admin role (bootstrap / lock-out recovery)."""
        user = User.query.filter(db.func.lower(User.email) == email.strip().lower()).first()
        if not user:
            raise click.ClickException(f"no account with email {email}")
        role = AdminRole.query.filter_by(is_super=True).first()
        if not role:
            raise click.ClickException("no super-admin role -- run `flask db upgrade` first")
        user.admin_role_id = role.id
        user.is_admin = True
        db.session.commit()
        click.echo(f"{user.email} is now a super admin.")
