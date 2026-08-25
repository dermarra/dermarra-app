import html

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


def _e(value):
    """Escapes a value for safe interpolation into an email's HTML body.
    Every field below comes from somewhere a person typed it in -- a
    user's full_name, a shipping address, a product name an admin
    entered -- so none of it is safe to drop into HTML unescaped."""
    return html.escape(str(value)) if value is not None else ""


def _send(email, *, failure_label):
    """Every transactional send goes through here so a failure is always
    logged, regardless of the exact exception type Brevo's SDK raises --
    catching only ApiException would miss lower-level connection/timeout
    errors and let them vanish into a caller's bare `except: pass` with
    no trace anywhere."""
    api_instance = _get_client()
    try:
        api_instance.send_transac_email(email)
    except Exception as e:
        current_app.logger.error(f"Brevo {failure_label} failed: {e}")
        raise


def _email_shell(body_html):
    """A consistent branded wrapper every transactional email renders
    inside, instead of each function hand-rolling its own bare <p> tags
    with no visual identity."""
    return (
        '<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;'
        'max-width:560px;margin:0 auto;color:#3A3733;">'
        '<div style="padding:24px 0;border-bottom:2px solid #ECECEB;">'
        '<span style="font-size:20px;font-weight:600;letter-spacing:-0.02em;">'
        'Dermarra<span style="color:#F47A53;">+</span></span>'
        "</div>"
        f'<div style="padding:24px 0;">{body_html}</div>'
        '<div style="padding:16px 0;border-top:1px solid #ECECEB;'
        'font-size:12px;color:#8A867E;">'
        "Dermarra Skincare"
        "</div>"
        "</div>"
    )


def send_welcome_email(user):
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject="Welcome to Dermarra Skincare",
        html_content=_email_shell(
            f"<p>Hi {_e(user.full_name)},</p>"
            "<p>Welcome to Dermarra Skincare. Take our skin quiz to get a routine "
            "matched to your skin concerns.</p>"
        ),
    )
    _send(email, failure_label="welcome email")


def send_password_reset_email(user, reset_url):
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject="Reset your Dermarra Skincare password",
        html_content=_email_shell(
            f"<p>Hi {_e(user.full_name)},</p>"
            "<p>Someone requested a password reset for this account. If that was you, "
            "click the link below -- it expires in 30 minutes:</p>"
            f'<p><a href="{reset_url}" style="color:#F47A53;">{reset_url}</a></p>'
            "<p>If you didn't request this, you can safely ignore this email.</p>"
        ),
    )
    _send(email, failure_label="password reset email")


def send_order_confirmation_email(user, order):
    items_html = "".join(
        f"<li>{_e(item.name_snapshot)} x{item.quantity} — "
        f"KES {item.unit_price_cents_snapshot * item.quantity / 100:.0f}</li>"
        for item in order.items
    )
    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject=f"Your Dermarra Skincare order #{order.id[:8]} is confirmed",
        html_content=_email_shell(
            f"<p>Hi {_e(user.full_name)}, thanks for your order.</p>"
            f"<ul>{items_html}</ul>"
            f"<p>Total: KES {order.total_cents / 100:.0f}</p>"
            f"<p>M-Pesa receipt: {_e(order.mpesa_receipt_number)}</p>"
        ),
    )
    _send(email, failure_label="order confirmation")


_SHIPPING_STATUS_COPY = {
    "shipped": (
        "Your order is on its way",
        "Good news -- your order has shipped.",
    ),
    "delivered": (
        "Your order has been delivered",
        "Your order has been marked as delivered. We hope you love it.",
    ),
}


def send_shipping_update_email(user, order):
    """Fired when an admin advances an order to `shipped` or `delivered`
    (see order_transitions.py's can_advance) -- the two lifecycle points a
    customer actually needs to hear about after their order confirmation."""
    copy = _SHIPPING_STATUS_COPY.get(order.status)
    if not copy:
        raise ValueError(f"no shipping-update copy defined for order status {order.status!r}")
    subject_line, intro = copy

    tracking_html = ""
    if order.status == "shipped" and order.tracking_number:
        tracking_html = f"<p>Tracking number: <strong>{_e(order.tracking_number)}</strong></p>"

    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject=f"{subject_line} -- order #{order.id[:8]}",
        html_content=_email_shell(
            f"<p>Hi {_e(user.full_name)},</p>"
            f"<p>{intro}</p>"
            f"{tracking_html}"
            f"<p>Order #{order.id[:8]} · Total: KES {order.total_cents / 100:.0f}</p>"
        ),
    )
    _send(email, failure_label="shipping update email")


def send_order_invoice_email(user, order):
    rows_html = "".join(
        f"<tr>"
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;">{_e(item.name_snapshot)}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;text-align:center;">{item.quantity}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;text-align:right;">'
        f"KES {item.unit_price_cents_snapshot / 100:.0f}</td>"
        f'<td style="padding:8px;border-bottom:1px solid #ECECEB;text-align:right;">'
        f"KES {item.unit_price_cents_snapshot * item.quantity / 100:.0f}</td>"
        f"</tr>"
        for item in order.items
    )

    address_html = ""
    if order.shipping_address_line1:
        address_html = (
            '<p style="color:#64615A;margin-top:24px;">'
            f"{_e(order.shipping_name)}<br>"
            f"{_e(order.shipping_address_line1)}<br>"
            + (f"{_e(order.shipping_address_line2)}<br>" if order.shipping_address_line2 else "")
            + f"{_e(order.shipping_city)}, {_e(order.shipping_country)} {_e(order.shipping_postal_code)}<br>"
            f"{_e(order.shipping_phone)}"
            "</p>"
        )

    receipt_html = (
        f'<p style="color:#64615A;">M-Pesa receipt: {_e(order.mpesa_receipt_number)}</p>'
        if order.mpesa_receipt_number else ""
    )

    email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": user.email, "name": user.full_name}],
        sender=_sender(),
        subject=f"Invoice for your Dermarra Skincare order #{order.id[:8]}",
        html_content=_email_shell(
            f'<h2 style="color:#F47A53;">Invoice #{order.id[:8]}</h2>'
            f'<p>{order.created_at.strftime("%d %b %Y")}</p>'
            '<table style="width:100%;border-collapse:collapse;margin-top:16px;">'
            "<thead><tr>"
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #64615A;">Item</th>'
            '<th style="text-align:center;padding:8px;border-bottom:2px solid #64615A;">Qty</th>'
            '<th style="text-align:right;padding:8px;border-bottom:2px solid #64615A;">Unit price</th>'
            '<th style="text-align:right;padding:8px;border-bottom:2px solid #64615A;">Total</th>'
            f"</tr></thead><tbody>{rows_html}</tbody>"
            "<tfoot>"
            f'<tr><td colspan="3" style="padding:8px;text-align:right;">Subtotal</td>'
            f'<td style="padding:8px;text-align:right;">KES {order.subtotal_cents / 100:.0f}</td></tr>'
            f'<tr><td colspan="3" style="padding:8px;text-align:right;">Shipping</td>'
            f'<td style="padding:8px;text-align:right;">KES {order.shipping_cents / 100:.0f}</td></tr>'
            f'<tr style="font-weight:bold;color:#F47A53;">'
            f'<td colspan="3" style="padding:8px;text-align:right;">Total</td>'
            f'<td style="padding:8px;text-align:right;">KES {order.total_cents / 100:.0f}</td></tr>'
            "</tfoot>"
            "</table>"
            f"{receipt_html}"
            f"{address_html}"
            '<p style="margin-top:24px;">Thank you for shopping with Dermarra Skincare.</p>'
        ),
    )
    _send(email, failure_label="invoice email")


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
