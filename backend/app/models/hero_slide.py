import uuid

from app.extensions import db


class HeroSlide(db.Model):
    """One slide in the homepage hero carousel -- admin-managed marketing
    content, not tied to a specific Product/Routine row (the CTA link is
    free text so admin can point it at any page: a product, a shop-by
    category, the quiz, etc.)."""

    __tablename__ = "hero_slides"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    eyebrow = db.Column(db.String(120))
    title = db.Column(db.String(255), nullable=False)
    subtitle = db.Column(db.Text)
    cloudinary_public_id = db.Column(db.String(255))
    cta_label = db.Column(db.String(60))
    cta_link = db.Column(db.String(255))
    position = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "eyebrow": self.eyebrow,
            "title": self.title,
            "subtitle": self.subtitle,
            "cloudinary_public_id": self.cloudinary_public_id,
            "cta_label": self.cta_label,
            "cta_link": self.cta_link,
            "position": self.position,
            "is_active": self.is_active,
        }
