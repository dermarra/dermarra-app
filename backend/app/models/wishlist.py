import uuid
from datetime import datetime, timezone

from app.extensions import db


class Wishlist(db.Model):
    __tablename__ = "wishlists"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, unique=True)
    updated_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    items = db.relationship("WishlistItem", backref="wishlist", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "items": [item.to_dict() for item in self.items]}


class WishlistItem(db.Model):
    __tablename__ = "wishlist_items"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wishlist_id = db.Column(db.String(36), db.ForeignKey("wishlists.id"), nullable=False)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    product = db.relationship("Product", lazy="joined")

    __table_args__ = (db.UniqueConstraint("wishlist_id", "product_id", name="uq_wishlist_product"),)

    def to_dict(self):
        return {
            "id": self.id,
            "product": self.product.to_dict(include_concerns=False) if self.product else None,
        }
