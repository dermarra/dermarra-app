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
        timeout=45,
    )
    if not response.ok:
        current_app.logger.error(
            "Daraja STK response %s: %s",
            response.status_code,
            response.text,
        )
        raise DarajaError(_error_message(response) or f"M-Pesa rejected the request (HTTP {response.status_code})")
    return response.json()


class DarajaError(Exception):
    """Daraja answered, but refused the request -- carries Safaricom's own
    message (e.g. "Invalid CallBackURL") so it can be shown/logged instead
    of a generic "could not reach M-Pesa"."""


def _json_or_none(response):
    try:
        return response.json()
    except ValueError:
        return None


def _error_message(response):
    data = _json_or_none(response) or {}
    return data.get("errorMessage") or data.get("ResponseDescription")


def query_stk_status(checkout_request_id):
    """Active poll against Daraja -- the fallback when the callback is
    delayed or never arrives (dead ngrok tunnel, wrong MPESA_CALLBACK_URL).

    Returns Daraja's JSON. While the customer hasn't answered the prompt
    yet, Daraja replies HTTP 500 with errorCode 500.001.1001 ("the
    transaction is being processed") -- that's a normal "still pending"
    answer, returned here as a dict with no ResultCode rather than raised.
    Only genuine failures (network, auth, malformed) raise."""
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
    data = _json_or_none(response)
    if not response.ok and data and data.get("errorCode") == PENDING_ERROR_CODE:
        return data
    if not response.ok:
        current_app.logger.error("Daraja STK query %s: %s", response.status_code, response.text)
        raise DarajaError(_error_message(response) or f"M-Pesa status query failed (HTTP {response.status_code})")
    return data


PENDING_ERROR_CODE = "500.001.1001"


# ResultCodes that mean "not finished yet", not a failure. Daraja's query API
# returns 4999 ("The transaction is still under processing") while the
# customer is still on the PIN prompt -- treating it as a failure marked a
# live payment as failed mid-PIN (seen 2026-11-06).
PENDING_RESULT_CODES = {"4999"}


def is_pending(result_code):
    return result_code is not None and str(result_code) in PENDING_RESULT_CODES


def is_success(result_code):
    """Callback sends ResultCode as an int, the query endpoint as a string."""
    return result_code is not None and str(result_code) == "0"
