import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


# Load environment variables from .env file if it exists
class Config:
    """Represents a config."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev")

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    # Disables SQLAlchemy's modification-tracking feature — extra memory overhead, not needed here.
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,  # avoids stale-connection errors against Supabase's pooler
        "pool_size": 5,
        "max_overflow": 20,
        "pool_recycle": 300,
    }

    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-jwt")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", 60))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 30))
    )

    CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

    BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
    BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL")
    BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "Dermarra Skincare")
    BREVO_NEWSLETTER_LIST_ID = int(os.environ.get("BREVO_NEWSLETTER_LIST_ID", 0)) or None

    # M-Pesa Daraja (Safaricom) -- Lipa Na M-Pesa Online (STK Push)
    MPESA_ENV = os.environ.get("MPESA_ENV", "sandbox")
    MPESA_CONSUMER_KEY = os.environ.get("MPESA_CONSUMER_KEY")
    MPESA_CONSUMER_SECRET = os.environ.get("MPESA_CONSUMER_SECRET")
    MPESA_SHORTCODE = os.environ.get("MPESA_SHORTCODE")
    MPESA_PASSKEY = os.environ.get("MPESA_PASSKEY")
    MPESA_CALLBACK_URL = os.environ.get("MPESA_CALLBACK_URL")

    # The single canonical frontend URL used to build links inside emails
    # (password reset, etc.) -- distinct from FRONTEND_ORIGINS below, which
    # is the full comma-separated CORS allowlist (multiple dev ports).
    FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173")

    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.environ.get(
            "FRONTEND_ORIGIN",
            "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
            "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175",
        ).split(",")
        if origin.strip()
    ]


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

# Config keys that must never run in production with their insecure
# development fallback -- a forged JWT or session is possible if either
# secret is left at its default, so this fails the app at boot instead
# of silently serving traffic with a publicly-known key.
_REQUIRED_IN_PRODUCTION = {
    "SECRET_KEY": "dev",
    "JWT_SECRET_KEY": "dev-jwt",
}
# Not security-critical, but each gates a real feature (image upload,
# transactional email, M-Pesa payments) that fails confusingly at
# request time if unset -- surfaced as one clear warning at boot instead.
# Maps the Flask config key to check -> the .env variable name to show in
# the warning, since they don't always match (SQLALCHEMY_DATABASE_URI is
# set from DATABASE_URL, not from a same-named variable).
_RECOMMENDED_IN_PRODUCTION = {
    "SQLALCHEMY_DATABASE_URI": "DATABASE_URL",
    "CLOUDINARY_CLOUD_NAME": "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY": "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET": "CLOUDINARY_API_SECRET",
    "BREVO_API_KEY": "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL": "BREVO_SENDER_EMAIL",
    "MPESA_CONSUMER_KEY": "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET": "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE": "MPESA_SHORTCODE",
    "MPESA_PASSKEY": "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL": "MPESA_CALLBACK_URL",
}


def validate_production_config(app):
    insecure = [
        key for key, default in _REQUIRED_IN_PRODUCTION.items()
        if not app.config.get(key) or app.config.get(key) == default
    ]
    if insecure:
        raise RuntimeError(
            "Refusing to start in production with insecure/missing config: "
            f"{', '.join(insecure)}. Set these as real environment variables "
            "(e.g. `python -c \"import secrets; print(secrets.token_hex(32))\"`)."
        )

    missing = [
        env_name for config_key, env_name in _RECOMMENDED_IN_PRODUCTION.items()
        if not app.config.get(config_key)
    ]
    if missing:
        app.logger.warning(
            "Starting in production with unset config (the matching feature "
            f"will fail at request time, not at boot): {', '.join(missing)}"
        )
