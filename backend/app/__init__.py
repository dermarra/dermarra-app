import os

from flask import Flask

from app.config import config_by_name, validate_production_config
from app.extensions import db, migrate, jwt, cors


def create_app(config_name=None):
    config_name = config_name or os.environ.get("FLASK_ENV", "development")
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    if config_name == "production":
        validate_production_config(app)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]}})

    from app.routes.auth import auth_bp
    from app.routes.products import products_bp
    from app.routes.routines import routines_bp
    from app.routes.cart import cart_bp
    from app.routes.wishlist import wishlist_bp
    from app.routes.orders import orders_bp
    from app.routes.payments import payments_bp
    from app.routes.hero import hero_bp
    from app.routes.newsletter import newsletter_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(products_bp, url_prefix="/api/products")
    app.register_blueprint(routines_bp, url_prefix="/api/routines")
    app.register_blueprint(cart_bp, url_prefix="/api/cart")
    app.register_blueprint(wishlist_bp, url_prefix="/api/wishlist")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(hero_bp, url_prefix="/api/hero-slides")
    app.register_blueprint(newsletter_bp, url_prefix="/api/newsletter")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    from app.utils.errors import register_error_handlers

    register_error_handlers(app)

    # ensure models are registered with SQLAlchemy for `flask db migrate`
    from app import models  # noqa: F401

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app
