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


def send_password_reset_email(user, reset_url):
    api_instance = _get_client()
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject="Reset your Derma Skincare password",
        html_content=(
            f"<p>Hi {user.full_name},</p>"
            "<p>Someone requested a password reset for this account. If that was you, "
            f'click the link below -- it expires in 30 minutes:</p>'
            f'<p><a href="{reset_url}">{reset_url}</a></p>'
            "<p>If you didn't request this, you can safely ignore this email.</p>"
        ),
    )
    try:
        api_instance.send_transac_email(email)
    except ApiException as e:
        current_app.logger.error(f"Brevo password reset email failed: {e}")
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


def send_order_invoice_email(user, order):
    api_instance = _get_client()

    rows_html = "".join(
        f'<tr>'
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;">{item.name_snapshot}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;text-align:center;">{item.quantity}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;text-align:right;">'
        f'KES {item.unit_price_cents_snapshot / 100:.0f}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;text-align:right;">'
        f'KES {item.unit_price_cents_snapshot * item.quantity / 100:.0f}</td>'
        f'</tr>'
        for item in order.items
    )

    address_html = ""
    if order.shipping_address_line1:
        address_html = (
            '<p style="color:#64615A;margin-top:24px;">'
            f'{order.shipping_name or ""}<br>'
            f'{order.shipping_address_line1}<br>'
            + (f'{order.shipping_address_line2}<br>' if order.shipping_address_line2 else "")
            + f'{order.shipping_city}, {order.shipping_country} {order.shipping_postal_code or ""}<br>'
            f'{order.shipping_phone or ""}'
            '</p>'
        )

    receipt_html = (
        f'<p style="color:#64615A;">M-Pesa receipt: {order.mpesa_receipt_number}</p>'
        if order.mpesa_receipt_number else ""
    )

    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject=f"Invoice for your Derma Skincare order #{order.id[:8]}",
        html_content=(
            '<div style="font-family:sans-serif;color:#64615A;max-width:560px;">'
            f'<h2 style="color:#F47A53;">Invoice #{order.id[:8]}</h2>'
            f'<p>{order.created_at.strftime("%d %b %Y")}</p>'
            '<table style="width:100%;border-collapse:collapse;margin-top:16px;">'
            '<thead><tr>'
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #64615A;">Item</th>'
            '<th style="text-align:center;padding:8px;border-bottom:2px solid #64615A;">Qty</th>'
            '<th style="text-align:right;padding:8px;border-bottom:2px solid #64615A;">Unit price</th>'
            '<th style="text-align:right;padding:8px;border-bottom:2px solid #64615A;">Total</th>'
            f'</tr></thead><tbody>{rows_html}</tbody>'
            '<tfoot>'
            f'<tr><td colspan="3" style="padding:8px;text-align:right;">Subtotal</td>'
            f'<td style="padding:8px;text-align:right;">KES {order.subtotal_cents / 100:.0f}</td></tr>'
            f'<tr><td colspan="3" style="padding:8px;text-align:right;">Shipping</td>'
            f'<td style="padding:8px;text-align:right;">KES {order.shipping_cents / 100:.0f}</td></tr>'
            f'<tr style="font-weight:bold;color:#F47A53;">'
            f'<td colspan="3" style="padding:8px;text-align:right;">Total</td>'
            f'<td style="padding:8px;text-align:right;">KES {order.total_cents / 100:.0f}</td></tr>'
            '</tfoot>'
            '</table>'
            f'{receipt_html}'
            f'{address_html}'
            '<p style="margin-top:24px;">Thank you for shopping with Derma Skincare.</p>'
            '</div>'
        ),
    )
    try:
        api_instance.send_transac_email(email)
    except ApiException as e:
        current_app.logger.error(f"Brevo invoice email failed: {e}")
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
