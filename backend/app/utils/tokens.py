import hashlib

from flask import current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.models.user import User

_RESET_SALT = "password-reset"
RESET_TOKEN_MAX_AGE_SECONDS = 30 * 60

# Deliberately itsdangerous, not a flask_jwt_extended access token: a
# password-reset link travels over email (a less secure channel) and
# must never double as a bearer token that could hit @jwt_required()
# routes if it leaked -- this serializer only ever verifies against the
# "password-reset" salt, for this one purpose.


def _password_fingerprint(user):
    """A short, one-way derivative of the current password_hash, embedded
    in the token so it stops verifying the moment the password actually
    changes -- makes an itsdangerous token (which has no server-side
    revocation list) single-use in practice, without a DB table. Never
    embed password_hash itself: URLSafeTimedSerializer signs, it doesn't
    encrypt, so the payload is base64-readable by whoever holds the link."""
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:16]


def generate_password_reset_token(user):
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    payload = {"uid": user.id, "fp": _password_fingerprint(user)}
    return serializer.dumps(payload, salt=_RESET_SALT)


def verify_password_reset_token(token):
    """Returns the User the token was issued for, or None if it's
    invalid, tampered with, expired, or already consumed (the password
    changed since -- see _password_fingerprint)."""
    serializer = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        payload = serializer.loads(token, salt=_RESET_SALT, max_age=RESET_TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None

    user = User.query.get(payload.get("uid"))
    if not user or _password_fingerprint(user) != payload.get("fp"):
        return None
    return user
