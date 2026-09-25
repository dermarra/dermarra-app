import uuid
from datetime import datetime, timezone

from app.extensions import db


class Coupon(db.Model):
    """A discount code, applied to a Cart and snapshotted onto the Order at
    checkout (see Order.coupon_code_snapshot/discount_cents -- same
    rationale as OrderItem.name_snapshot: order history must keep reading
    correctly even if this row is later edited or deleted).

    `used_count` is two-phase, mirroring inventory_service.py's reserve ->
    consume/release pattern: incremented at checkout (order creation),
    decremented if that order is cancelled before ever completing or if an
    admin cancels an already-paid order, never decremented once consumed by
    a genuinely completed sale. See coupon_service.py.
    """

    __tablename__ = "coupons"

    DISCOUNT_TYPES = ("percent", "fixed_cents")

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = db.Column(db.String(40), unique=True, nullable=False)
    discount_type = db.Column(db.String(20), nullable=False)
    # 1-100 for "percent", a cents amount for "fixed_cents".
    discount_value = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    max_uses = db.Column(db.Integer, nullable=True)
    used_count = db.Column(db.Integer, default=0, nullable=False)
    first_order_only = db.Column(db.Boolean, default=False, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self, include_admin_fields=False):
        data = {
            "id": self.id,
            "code": self.code,
            "discount_type": self.discount_type,
            "discount_value": self.discount_value,
            "first_order_only": self.first_order_only,
        }
        if include_admin_fields:
            data.update({
                "is_active": self.is_active,
                "max_uses": self.max_uses,
                "used_count": self.used_count,
                "expires_at": self.expires_at.isoformat() if self.expires_at else None,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            })
        return data
