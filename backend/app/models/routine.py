import uuid
from datetime import datetime, timezone

from app.extensions import db


class Routine(db.Model):
    """A curated, ordered bundle of products, e.g. 'Brightening Routine'."""

    __tablename__ = "routines"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False)
    tagline = db.Column(db.String(255))
    description = db.Column(db.Text)
    primary_concern_id = db.Column(db.String(36), db.ForeignKey("skin_concerns.id"))
    cloudinary_public_id = db.Column(db.String(255))
    bundle_discount_percent = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    primary_concern = db.relationship("SkinConcern")
    steps = db.relationship(
        "RoutineStep",
        backref="routine",
        order_by="RoutineStep.order_index",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "tagline": self.tagline,
            "description": self.description,
            "primary_concern": self.primary_concern.to_dict() if self.primary_concern else None,
            "bundle_discount_percent": self.bundle_discount_percent,
            "cloudinary_public_id": self.cloudinary_public_id,
            "steps": [step.to_dict() for step in self.steps],
        }


class RoutineStep(db.Model):
    """One ordered step within a routine, e.g. step 2 = Serum, for AM or PM."""

    __tablename__ = "routine_steps"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    routine_id = db.Column(db.String(36), db.ForeignKey("routines.id"), nullable=False)
    product_id = db.Column(db.String(36), db.ForeignKey("products.id"), nullable=False)
    order_index = db.Column(db.Integer, nullable=False)
    time_of_day = db.Column(db.String(10), nullable=False, default="both")

    product = db.relationship("Product", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "order_index": self.order_index,
            "time_of_day": self.time_of_day,
            "product": self.product.to_dict(include_concerns=False),
        }
