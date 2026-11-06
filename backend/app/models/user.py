import uuid
from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(30))
    # Admin access = having an admin role. `is_admin` is kept in step with
    # `admin_role_id` (set together in the admin access routes) so existing
    # checks -- the storefront's Admin link, AdminRoute, dashboard customer
    # counts -- keep working unchanged.
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    admin_role_id = db.Column(db.String(36), db.ForeignKey("admin_roles.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    default_shipping_name = db.Column(db.String(255))
    default_shipping_address_line1 = db.Column(db.String(255))
    default_shipping_address_line2 = db.Column(db.String(255))
    default_shipping_city = db.Column(db.String(120))
    default_shipping_country = db.Column(db.String(120))
    default_shipping_postal_code = db.Column(db.String(30))
    default_shipping_phone = db.Column(db.String(30))

    orders = db.relationship("Order", backref="user", lazy="dynamic")
    cart = db.relationship("Cart", backref="user", uselist=False)
    admin_role = db.relationship("AdminRole", back_populates="members")

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    def _admin_role_summary(self):
        if not self.is_admin or not self.admin_role:
            return None
        r = self.admin_role
        return {"id": r.id, "key": r.key, "name": r.name, "is_super": r.is_super}

    def _permission_list(self):
        from app.utils.permissions import user_permissions

        return sorted(user_permissions(self))

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "phone": self.phone,
            "is_admin": self.is_admin,
            "admin_role": self._admin_role_summary(),
            "permissions": self._permission_list(),
            "default_shipping": {
                "name": self.default_shipping_name,
                "address_line1": self.default_shipping_address_line1,
                "address_line2": self.default_shipping_address_line2,
                "city": self.default_shipping_city,
                "country": self.default_shipping_country,
                "postal_code": self.default_shipping_postal_code,
                "phone": self.default_shipping_phone,
            },
        }
