import uuid
from datetime import datetime, timezone

from app.extensions import db


class Cart(db.Model):
    __tablename__ = "carts"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, unique=True)
    updated_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    items = db.relationship("CartItem", backref="cart", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "items": [item.to_dict() for item in self.items]}


class CartItem(db.Model):
    __tablename__ = "cart_items"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cart_id = db.Column(db.String(36), db.ForeignKey("carts.id"), nullable=False)

    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=True)
    routine_id = db.Column(db.String(36), db.ForeignKey("routines.id"), nullable=True)
    quantity = db.Column(db.Integer, default=1, nullable=False)

    product = db.relationship("Product", lazy="joined")
    routine = db.relationship("Routine", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "quantity": self.quantity,
            "product": self.product.to_dict(include_concerns=False) if self.product else None,
            "routine": self.routine.to_dict() if self.routine else None,
        }
