import base64
import re
from datetime import datetime

import requests
from flask import current_app

SANDBOX_BASE_URL = "https://sandbox.safaricom.co.ke"
PRODUCTION_BASE_URL = "https://api.safaricom.co.ke"


def _base_url():
    return PRODUCTION_BASE_URL if current_app.config["MPESA_ENV"] == "production" else SANDBOX_BASE_URL


def format_phone(raw_phone):
    """Normalizes a Kenyan phone number to 2547XXXXXXXX / 2541XXXXXXXX,
    accepting common input forms like 07..., +254..., 254..."""
    digits = re.sub(r"\D", "", raw_phone)
    if digits.startswith("0") and len(digits) == 10:
        return "254" + digits[1:]
    if digits.startswith("254") and len(digits) == 12:
        return digits
    if (digits.startswith("7") or digits.startswith("1")) and len(digits) == 9:
        return "254" + digits
    raise ValueError("Enter a valid Kenyan phone number, e.g. 0712345678")


def get_access_token():
    consumer_key = current_app.config["MPESA_CONSUMER_KEY"]
    consumer_secret = current_app.config["MPESA_CONSUMER_SECRET"]
    response = requests.get(
        f"{_base_url()}/oauth/v1/generate?grant_type=client_credentials",
        auth=(consumer_key, consumer_secret),
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _password_and_timestamp():
    shortcode = current_app.config["MPESA_SHORTCODE"]
    passkey = current_app.config["MPESA_PASSKEY"]
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    raw = f"{shortcode}{passkey}{timestamp}"
    password = base64.b64encode(raw.encode()).decode()
    return password, timestamp


def stk_push(*, phone, amount_kes, account_reference, transaction_desc):
    """Initiates a Lipa Na M-Pesa Online (STK Push) request. Returns the
    raw Daraja response, including CheckoutRequestID -- store this on the
    Order so the callback can match it back up."""
    access_token = get_access_token()
    password, timestamp = _password_and_timestamp()
    shortcode = current_app.config["MPESA_SHORTCODE"]
    callback_url = current_app.config["MPESA_CALLBACK_URL"]

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(round(amount_kes)),
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        "AccountReference": account_reference[:12],
        "TransactionDesc": transaction_desc[:13],
    }

    response = requests.post(
        f"{_base_url()}/mpesa/stkpush/v1/processrequest",
        json=payload,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def query_stk_status(checkout_request_id):
    """Optional active poll against Daraja as a fallback if the callback
    is delayed or missed (e.g. local dev without a stable ngrok tunnel)."""
    access_token = get_access_token()
    password, timestamp = _password_and_timestamp()
    shortcode = current_app.config["MPESA_SHORTCODE"]

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }
    response = requests.post(
        f"{_base_url()}/mpesa/stkpushquery/v1/query",
        json=payload,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()
