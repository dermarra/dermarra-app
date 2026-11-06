import uuid
from datetime import datetime, timezone

from app.extensions import db


class AdminRole(db.Model):
    """An editable bundle of admin permissions (keys from
    app/utils/permissions.py). A user has admin access when they have a
    role. The super-admin role (``is_super``) holds every permission and
    can't be edited or deleted; there must always be at least one super
    admin (enforced in the admin access routes)."""

    __tablename__ = "admin_roles"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = db.Column(db.String(60), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    permissions = db.Column(db.JSON, nullable=False, default=list)
    is_super = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    members = db.relationship("User", back_populates="admin_role", lazy="dynamic")

    def to_dict(self, include_counts=False):
        from app.utils.permissions import role_permissions

        data = {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "is_super": self.is_super,
            "permissions": sorted(role_permissions(self)) if self.is_super else list(self.permissions or []),
        }
        if include_counts:
            data["member_count"] = self.members.count()
        return data


class AdminActivity(db.Model):
    """Append-only log of successful admin changes (every non-GET admin
    request that succeeded -- recorded automatically in
    app/routes/admin.py's after_request hook)."""

    __tablename__ = "admin_activity"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="SET NULL"), index=True)
    actor_name = db.Column(db.String(255))  # snapshot: survives the user being deleted
    action = db.Column(db.String(80), nullable=False, index=True)  # e.g. "orders.cancel"
    summary = db.Column(db.String(255), nullable=False)
    target_type = db.Column(db.String(40))
    target_id = db.Column(db.String(120))
    method = db.Column(db.String(10), nullable=False)
    path = db.Column(db.String(255), nullable=False)
    details = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "actor_name": self.actor_name,
            "action": self.action,
            "summary": self.summary,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "method": self.method,
            "path": self.path,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
