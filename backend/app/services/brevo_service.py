from flask import current_app
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException


def _get_client():
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = current_app.config["BREVO_API_KEY"]
    return sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))


def _sender():
    return {
        "email": current_app.config["BREVO_SENDER_EMAIL"],
        "name": current_app.config["BREVO_SENDER_NAME"],
    }


def send_welcome_email(user):
    api_instance = _get_client()
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject="Welcome to Derma Skincare",
        html_content=(
            f"<p>Hi {user.full_name},</p>"
            "<p>Welcome to Derma Skincare. Take our skin quiz to get a routine "
            "matched to your skin concerns.</p>"
        ),
    )
    try:
        api_instance.send_transac_email(email)
    except ApiException as e:
        current_app.logger.error(f"Brevo welcome email failed: {e}")
        raise


def send_order_confirmation_email(user, order):
    api_instance = _get_client()
    items_html = "".join(
        f"<li>{item.name_snapshot} x{item.quantity} — "
        f"KES {item.unit_price_cents_snapshot * item.quantity / 100:.0f}</li>"
        for item in order.items
    )
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject=f"Your Derma Skincare order #{order.id[:8]} is confirmed",
        html_content=(
            f"<p>Hi {user.full_name}, thanks for your order.</p>"
            f"<ul>{items_html}</ul>"
            f"<p>Total: KES {order.total_cents / 100:.0f}</p>"
            f"<p>M-Pesa receipt: {order.mpesa_receipt_number}</p>"
        ),
    )
    try:
        api_instance.send_transac_email(email)
    except ApiException as e:
        current_app.logger.error(f"Brevo order confirmation failed: {e}")
        raise


def add_contact_to_list(email, full_name, list_id):
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = current_app.config["BREVO_API_KEY"]
    contacts_api = sib_api_v3_sdk.ContactsApi(sib_api_v3_sdk.ApiClient(configuration))
    contact = sib_api_v3_sdk.CreateContact(
        email=email, attributes={"FULL_NAME": full_name}, list_ids=[list_id]
    )
    try:
        contacts_api.create_contact(contact)
    except ApiException as e:
        current_app.logger.error(f"Brevo contact creation failed: {e}")
        raise
