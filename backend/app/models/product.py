import uuid
from datetime import datetime, timezone

from app.extensions import db

product_concerns = db.Table(
    "product_concerns",
    db.Column("product_id", db.String(36), db.ForeignKey("products.id"), primary_key=True),
    db.Column("concern_id", db.String(36), db.ForeignKey("skin_concerns.id"), primary_key=True),
)


class SkinConcern(db.Model):
    """e.g. 'Hyperpigmentation', 'Acne', 'Barrier repair', 'Redness'."""

    __tablename__ = "skin_concerns"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), unique=True, nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "slug": self.slug, "description": self.description}


class Product(db.Model):
    __tablename__ = "products"

    STEP_TYPES = ("cleanser", "serum", "barrier_cream", "spf", "hair")
    LOW_STOCK_THRESHOLD = 10

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False)
    step_type = db.Column(db.String(30), nullable=False)
    short_description = db.Column(db.String(500))
    description = db.Column(db.Text)
    key_actives = db.Column(db.String(255))
    price_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), default="KES", nullable=False)
    stock_quantity = db.Column(db.Integer, default=0, nullable=False)
    cloudinary_public_id = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    skin_concerns = db.relationship(
        "SkinConcern", secondary=product_concerns, backref="products", lazy="joined"
    )
    images = db.relationship(
        "ProductImage", backref="product", order_by="ProductImage.position",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_concerns=True, include_admin_fields=False):
        data = {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "step_type": self.step_type,
            "short_description": self.short_description,
            "description": self.description,
            "key_actives": self.key_actives,
            "price_cents": self.price_cents,
            "currency": self.currency,
            "in_stock": self.stock_quantity > 0,
            "cloudinary_public_id": self.cloudinary_public_id,
        }
        if include_concerns:
            data["skin_concerns"] = [c.to_dict() for c in self.skin_concerns]
        if include_admin_fields:
            data["stock_quantity"] = self.stock_quantity
            data["images"] = [image.to_dict() for image in self.images]
        return data


class ProductImage(db.Model):
    __tablename__ = "product_images"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False)
    cloudinary_public_id = db.Column(db.String(255), nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)
    is_primary = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "cloudinary_public_id": self.cloudinary_public_id,
            "position": self.position,
            "is_primary": self.is_primary,
        }
