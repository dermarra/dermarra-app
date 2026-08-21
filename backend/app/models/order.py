import uuid
from datetime import datetime, timezone

from app.extensions import db


class Order(db.Model):
    __tablename__ = "orders"

    # "pending" = order created, awaiting payment initiation
    # "payment_pending" = STK push sent, waiting on the customer's PIN entry
    # "paid" -> "processing" -> "shipped" -> "delivered"
    # "payment_failed" / "cancelled" are terminal non-success states
    STATUSES = (
        "pending",
        "payment_pending",
        "paid",
        "payment_failed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(20), default="pending", nullable=False)
    subtotal_cents = db.Column(db.Integer, nullable=False)
    shipping_cents = db.Column(db.Integer, default=0, nullable=False)
    total_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), default="KES", nullable=False)

    payment_method = db.Column(db.String(20))
    mpesa_phone = db.Column(db.String(15))
    mpesa_checkout_request_id = db.Column(db.String(60), index=True)
    mpesa_merchant_request_id = db.Column(db.String(60))
    mpesa_receipt_number = db.Column(db.String(30))
    paid_at = db.Column(db.DateTime)

    shipping_name = db.Column(db.String(255))
    shipping_address_line1 = db.Column(db.String(255))
    shipping_address_line2 = db.Column(db.String(255))
    shipping_city = db.Column(db.String(120))
    shipping_country = db.Column(db.String(120))
    shipping_postal_code = db.Column(db.String(30))
    shipping_phone = db.Column(db.String(30))

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    delivery_proof_public_id = db.Column(db.String(255), nullable=True)
    tracking_number = db.Column(db.String(120), nullable=True)

    items = db.relationship("OrderItem", backref="order", cascade="all, delete-orphan")

    def to_dict(self, include_admin_fields=False):
        data = {
            "id": self.id,
            "status": self.status,
            "subtotal_cents": self.subtotal_cents,
            "shipping_cents": self.shipping_cents,
            "total_cents": self.total_cents,
            "currency": self.currency,
            "payment_method": self.payment_method,
            "mpesa_receipt_number": self.mpesa_receipt_number,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "delivery_proof_public_id": self.delivery_proof_public_id,
            "tracking_number": self.tracking_number,
            "shipping": {
                "name": self.shipping_name,
                "address_line1": self.shipping_address_line1,
                "address_line2": self.shipping_address_line2,
                "city": self.shipping_city,
                "country": self.shipping_country,
                "postal_code": self.shipping_postal_code,
                "phone": self.shipping_phone,
            },
            "created_at": self.created_at.isoformat(),
            "items": [item.to_dict() for item in self.items],
        }
        if include_admin_fields:
            data["user_id"] = self.user_id
            data["user_email"] = self.user.email if self.user else None
        return data


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = db.Column(db.String(36), db.ForeignKey("orders.id"), nullable=False)

    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=True)
    routine_id = db.Column(db.String(36), db.ForeignKey("routines.id"), nullable=True)
    name_snapshot = db.Column(db.String(255), nullable=False)
    unit_price_cents_snapshot = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name_snapshot,
            "unit_price_cents": self.unit_price_cents_snapshot,
            "quantity": self.quantity,
            "line_total_cents": self.unit_price_cents_snapshot * self.quantity,
        }
