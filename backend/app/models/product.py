import uuid
from datetime import datetime, timezone

from app.extensions import db

product_concerns = db.Table(
    "product_concerns",
    db.Column("product_id", db.String(36), db.ForeignKey("products.id"), primary_key=True),
    db.Column("concern_id", db.String(36), db.ForeignKey("skin_concerns.id"), primary_key=True),
)

product_ingredients = db.Table(
    "product_ingredients",
    db.Column("product_id", db.String(36), db.ForeignKey("products.id"), primary_key=True),
    db.Column("ingredient_id", db.String(36), db.ForeignKey("ingredients.id"), primary_key=True),
)


class SkinConcern(db.Model):
    """e.g. 'Hyperpigmentation', 'Acne', 'Barrier repair', 'Redness'."""

    __tablename__ = "skin_concerns"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), unique=True, nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text)
    cloudinary_public_id = db.Column(db.String(255))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "cloudinary_public_id": self.cloudinary_public_id,
        }


class Ingredient(db.Model):
    """e.g. 'Vitamin C', 'Niacinamide', 'Salicylic Acid' -- a clean, filterable
    tag, distinct from Product.key_actives (a free-text display string like
    '10% Ascorbic Acid')."""

    __tablename__ = "ingredients"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), unique=True, nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text)
    cloudinary_public_id = db.Column(db.String(255))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "cloudinary_public_id": self.cloudinary_public_id,
        }


class StepGroup(db.Model):
    """A fixed, marketing-facing grouping of Product.STEP_TYPES for the
    'Shop by Step' section -- exactly 4 rows (prep/treat/seal/protect),
    seeded by migration. Unlike SkinConcern/Ingredient this taxonomy isn't
    open-ended, so there's no admin create/delete, only edit."""

    __tablename__ = "step_groups"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = db.Column(db.String(20), unique=True, nullable=False)
    label = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    cloudinary_public_id = db.Column(db.String(255))
    step_type = db.Column(db.String(30), nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "label": self.label,
            "description": self.description,
            "cloudinary_public_id": self.cloudinary_public_id,
            "step_type": self.step_type,
            "position": self.position,
        }


class Product(db.Model):
    __tablename__ = "products"

    STEP_TYPES = ("cleanser", "serum", "barrier_cream", "spf")

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False)
    step_type = db.Column(db.String(30), nullable=False)
    short_description = db.Column(db.String(500))
    description = db.Column(db.Text)
    key_actives = db.Column(db.String(255))
    price_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(3), default="KES", nullable=False)
    cloudinary_public_id = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    skin_concerns = db.relationship(
        "SkinConcern", secondary=product_concerns, backref="products", lazy="joined"
    )
    ingredients = db.relationship(
        "Ingredient", secondary=product_ingredients, backref="products", lazy="joined"
    )
    images = db.relationship(
        "ProductImage", backref="product", order_by="ProductImage.position",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_concerns=True, include_admin_fields=False):
        # `inventory` may be briefly absent right after a product is
        # created (before a stock level is ever set) -- never let a
        # missing row read as "in stock".
        stock_status = self.inventory.stock_status() if self.inventory else "out_of_stock"
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
            "in_stock": stock_status != "out_of_stock",
            "stock_status": stock_status,
            "cloudinary_public_id": self.cloudinary_public_id,
            "images": [image.to_dict() for image in self.images],
        }
        if include_concerns:
            data["skin_concerns"] = [c.to_dict() for c in self.skin_concerns]
            data["ingredients"] = [i.to_dict() for i in self.ingredients]
        if include_admin_fields:
            data["is_active"] = self.is_active
            if self.inventory:
                data.update({
                    "on_hand": self.inventory.on_hand,
                    "reserved": self.inventory.reserved,
                    "available": self.inventory.available,
                    "reorder_level": self.inventory.reorder_level,
                })
            else:
                data.update({"on_hand": 0, "reserved": 0, "available": 0, "reorder_level": 10})
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
