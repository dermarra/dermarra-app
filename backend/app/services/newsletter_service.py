"""Newsletter sign-ups -> the Brevo contact list in BREVO_NEWSLETTER_LIST_ID.

Used by the footer/blog form (POST /api/newsletter/subscribe) and the
opt-in tick boxes at sign-up and checkout.

Fixed 2026-11-06 (audit): an email that already existed in Brevo was
reported "subscribed" but never added to the list (create_contact without
update_enabled just errors "duplicate"), and names were sent in a
FULL_NAME attribute Brevo doesn't have, so they were dropped. Now:
update_enabled=True (existing contacts are added to the list too) and the
name goes into Brevo's own FIRSTNAME / LASTNAME attributes."""
import re

import sib_api_v3_sdk
from flask import current_app

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class NewsletterNotConfigured(Exception):
    pass


def subscribe(email, full_name=""):
    """Adds/updates the contact on the newsletter list. Raises
    NewsletterNotConfigured if no list is set, or Brevo's ApiException."""
    list_id = current_app.config.get("BREVO_NEWSLETTER_LIST_ID")
    if not list_id:
        raise NewsletterNotConfigured()
    first, _, last = (full_name or "").strip().partition(" ")
    attributes = {k: v for k, v in {"FIRSTNAME": first, "LASTNAME": last.strip()}.items() if v}

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = current_app.config["BREVO_API_KEY"]
    api = sib_api_v3_sdk.ContactsApi(sib_api_v3_sdk.ApiClient(configuration))
    contact = sib_api_v3_sdk.CreateContact(
        email=email, attributes=attributes or None, list_ids=[list_id], update_enabled=True
    )
    api.create_contact(contact)


def subscribe_quietly(email, full_name=""):
    """Opt-in side effect of sign-up/checkout: never fails the main action."""
    try:
        subscribe(email, full_name)
        return True
    except Exception:  # noqa: BLE001
        current_app.logger.exception("newsletter opt-in failed for %s", email)
        return False
