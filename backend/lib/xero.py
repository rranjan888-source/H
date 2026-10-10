"""Xero Accounting API client: OAuth2 tokens (stored in Mongo, auto-refreshed) and
customer/invoice sync helpers. Single organisation (tenant) per app."""

import base64
import logging
import os
import secrets
import time
from datetime import date, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from lib.common import log_activity
from lib.db import db
from models.crm import Customer, now_iso

logger = logging.getLogger(__name__)

AUTH_URL = "https://login.xero.com/identity/connect/authorize"
TOKEN_URL = "https://identity.xero.com/connect/token"
API = "https://api.xero.com/api.xro/2.0"
SCOPES = os.environ.get(
    "XERO_SCOPES", "openid profile email offline_access accounting.contacts accounting.invoices"
)


def _cid() -> str:
    return os.environ.get("XERO_CLIENT_ID", "")


def _secret() -> str:
    return os.environ.get("XERO_CLIENT_SECRET", "")


def configured() -> bool:
    return bool(_cid() and _secret())


def redirect_uri() -> str:
    return os.environ.get("XERO_REDIRECT_URI") or f"{os.environ.get('PUBLIC_APP_URL', '').rstrip('/')}/api/xero/callback"


def sales_account() -> str:
    return os.environ.get("XERO_SALES_ACCOUNT", "200")


def _require_config() -> None:
    if not configured():
        raise HTTPException(status_code=503, detail="Xero is not configured. Add XERO_CLIENT_ID and XERO_CLIENT_SECRET.")


async def _token_request(data: dict) -> dict:
    basic = base64.b64encode(f"{_cid()}:{_secret()}".encode()).decode()
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(TOKEN_URL, data=data, headers={"Authorization": f"Basic {basic}"})
    if r.status_code >= 400:
        logger.error("Xero token request failed: %s", r.status_code)
        raise HTTPException(status_code=502, detail="Xero authorisation failed. Please reconnect Xero.")
    return r.json()


# ---------- OAuth ----------
async def auth_url() -> str:
    _require_config()
    state = secrets.token_urlsafe(32)
    await db.xero_state.insert_one({"state": state, "expires": time.time() + 600})
    q = {"response_type": "code", "client_id": _cid(), "redirect_uri": redirect_uri(), "scope": SCOPES, "state": state}
    return f"{AUTH_URL}?{urlencode(q)}"


async def complete_auth(code: str, state: str) -> str:
    _require_config()
    s = await db.xero_state.find_one_and_delete({"state": state})
    if not s or s["expires"] < time.time():
        raise HTTPException(status_code=400, detail="Invalid or expired Xero sign-in. Please try again.")
    t = await _token_request({"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri()})
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get("https://api.xero.com/connections", headers={"Authorization": f"Bearer {t['access_token']}"})
    r.raise_for_status()
    tenants = [x for x in r.json() if x.get("tenantType") == "ORGANISATION"] or r.json()
    if not tenants:
        raise HTTPException(status_code=400, detail="No Xero organisation was connected")
    tenant = tenants[0]  # most recently authorised organisation
    await db.xero_connection.replace_one({"key": "primary"}, {
        "key": "primary", "tenant_id": tenant["tenantId"], "tenant_name": tenant.get("tenantName", ""),
        "access_token": t["access_token"], "refresh_token": t["refresh_token"],
        "expires_at": time.time() + int(t["expires_in"]), "connected_at": now_iso(),
    }, upsert=True)
    await log_activity(f"Xero connected to {tenant.get('tenantName', 'organisation')}")
    return tenant.get("tenantName", "")


async def connection() -> dict | None:
    return await db.xero_connection.find_one({"key": "primary"}, {"_id": 0})


async def disconnect() -> None:
    await db.xero_connection.delete_one({"key": "primary"})


async def _fresh(conn: dict) -> dict:
    if conn["expires_at"] > time.time() + 60:
        return conn
    t = await _token_request({"grant_type": "refresh_token", "refresh_token": conn["refresh_token"]})
    upd = {"access_token": t["access_token"], "refresh_token": t["refresh_token"],
           "expires_at": time.time() + int(t["expires_in"])}
    res = await db.xero_connection.update_one({"key": "primary", "refresh_token": conn["refresh_token"]}, {"$set": upd})
    if not res.modified_count:  # another request already rotated it — use the stored one
        return await connection() or {**conn, **upd}
    return {**conn, **upd}


async def xero(method: str, path: str, payload: dict | None = None, params: dict | None = None) -> dict:
    _require_config()
    conn = await connection()
    if not conn:
        raise HTTPException(status_code=409, detail="Xero is not connected")
    conn = await _fresh(conn)
    headers = {"Authorization": f"Bearer {conn['access_token']}", "Xero-tenant-id": conn["tenant_id"],
               "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, API + path, json=payload, params=params, headers=headers)
    if r.status_code == 401:
        raise HTTPException(status_code=403, detail="Xero access expired or missing permissions. Please reconnect Xero.")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail=f"Xero rate limit reached; retry in {r.headers.get('Retry-After', '60')}s")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Xero: {_xero_error(r)}")
    return r.json()


def _xero_error(r: httpx.Response) -> str:
    try:
        body = r.json()
    except ValueError:
        return r.text[:300]
    msgs = []
    for el in body.get("Elements", []):
        msgs += [v.get("Message", "") for v in el.get("ValidationErrors", [])]
    return "; ".join(m for m in msgs if m) or body.get("Message") or body.get("Detail") or str(r.status_code)


# ---------- Customers ----------
def _contact_body(c: dict) -> dict:
    first, _, last = (c.get("contact_name") or "").partition(" ")
    body: dict = {"Name": c["name"], "FirstName": first, "LastName": last, "EmailAddress": c.get("email", ""),
                  "TaxNumber": c.get("gst_number", ""),
                  "Phones": [{"PhoneType": "DEFAULT", "PhoneNumber": c.get("phone", "")}],
                  "Addresses": [{"AddressType": "STREET", "AddressLine1": c.get("address", ""), "City": c.get("city", "")}]}
    return body


async def push_customer(c: dict) -> str:
    cid = c.get("xero_contact_id")
    if not cid:  # link to an existing Xero contact with the same name (names are unique in Xero)
        name = c["name"].replace('"', "")
        found = await xero("GET", "/Contacts", params={"where": f'Name=="{name}"'})
        if found.get("Contacts"):
            cid = found["Contacts"][0]["ContactID"]
    if cid:
        data = await xero("POST", f"/Contacts/{cid}", {"Contacts": [_contact_body(c)]})
    else:
        data = await xero("PUT", "/Contacts", {"Contacts": [_contact_body(c)]})
    cid = data["Contacts"][0]["ContactID"]
    await db.customers.update_one({"id": c["id"]}, {"$set": {"xero_contact_id": cid, "xero_synced_at": now_iso()}})
    return cid


async def import_contacts() -> int:
    created = 0
    page = 1
    while True:
        data = await xero("GET", "/Contacts", params={"where": "ContactStatus==\"ACTIVE\"", "page": page})
        contacts = data.get("Contacts", [])
        for x in contacts:
            if await db.customers.find_one({"xero_contact_id": x["ContactID"]}):
                continue
            existing = await db.customers.find_one({"name": x["Name"]})
            if existing:
                await db.customers.update_one({"id": existing["id"]}, {"$set": {"xero_contact_id": x["ContactID"]}})
                continue
            phone = next((p.get("PhoneNumber", "") for p in x.get("Phones", []) if p.get("PhoneNumber")), "")
            addr = next((a for a in x.get("Addresses", []) if a.get("AddressLine1")), {})
            cust = Customer(
                name=x["Name"], type="Commercial" if x.get("TaxNumber") else "Residential",
                contact_name=" ".join(p for p in [x.get("FirstName", ""), x.get("LastName", "")] if p),
                email=x.get("EmailAddress", ""), phone=phone, address=addr.get("AddressLine1", ""),
                city=" ".join(p for p in [addr.get("City", ""), addr.get("PostalCode", "")] if p),
                gst_number=x.get("TaxNumber", ""), notes="Imported from Xero",
            )
            await db.customers.insert_one({**cust.model_dump(), "xero_contact_id": x["ContactID"],
                                           "xero_synced_at": now_iso()})
            created += 1
        if len(contacts) < 100:
            return created
        page += 1


# ---------- Invoices ----------
def _invoice_body(inv: dict, contact_id: str) -> dict:
    due = inv.get("due_date") or (date.fromisoformat(inv["date"]) + timedelta(days=7)).isoformat()
    return {
        "Type": "ACCREC", "Contact": {"ContactID": contact_id}, "InvoiceNumber": inv["number"],
        "Reference": inv.get("reference", ""), "Date": inv["date"], "DueDate": due,
        "LineAmountTypes": "Exclusive", "Status": "AUTHORISED",
        "LineItems": [{
            "Description": " — ".join(p for p in [i["description"], i.get("detail", "")] if p),
            "Quantity": i["qty"], "UnitAmount": i["unit_price"], "DiscountRate": i.get("discount", 0),
            "AccountCode": sales_account(), "TaxType": "OUTPUT2" if i.get("gst", 15) else "NONE",
        } for i in inv["items"]],
    }


async def push_invoice(inv: dict) -> dict:
    if inv["status"] == "Draft":
        raise HTTPException(status_code=400, detail="Send or approve the invoice before syncing it to Xero")
    cust = await db.customers.find_one({"id": inv["customer_id"]}, {"_id": 0})
    if not cust:
        raise HTTPException(status_code=400, detail="Customer not found")
    contact_id = await push_customer(cust)
    if inv.get("xero_invoice_id") and inv.get("xero_status") in ("PAID", "VOIDED", "DELETED"):
        return inv  # locked in Xero — only pull status back
    try:
        path = f"/Invoices/{inv['xero_invoice_id']}" if inv.get("xero_invoice_id") else "/Invoices"
        data = await xero("POST" if inv.get("xero_invoice_id") else "PUT", path, {"Invoices": [_invoice_body(inv, contact_id)]})
    except HTTPException as e:
        await db.documents.update_one({"id": inv["id"]}, {"$set": {"xero_error": str(e.detail)}})
        raise
    x = data["Invoices"][0]
    upd = {"xero_invoice_id": x["InvoiceID"], "xero_status": x.get("Status", ""), "xero_synced_at": now_iso(), "xero_error": ""}
    await db.documents.update_one({"id": inv["id"]}, {"$set": upd})
    await _apply_payment(inv, x)
    return {**inv, **upd}


async def _apply_payment(inv: dict, x: dict) -> bool:
    """Copy Xero's payment state onto the CRM invoice. Returns True when it changed."""
    paid = min(round(float(x.get("AmountPaid", 0) or 0), 2), inv["total"])
    upd: dict = {"xero_status": x.get("Status", "")}
    if paid > inv.get("amount_paid", 0) + 0.005:
        upd["amount_paid"] = paid
        if x.get("Status") == "PAID" or paid >= inv["total"] - 0.005:
            upd.update(status="Paid", paid_at=now_iso())
        await log_activity(f"Payment of ${paid - inv.get('amount_paid', 0):,.2f} for {inv['number']} synced from Xero", "payment")
    await db.documents.update_one({"id": inv["id"]}, {"$set": upd})
    return "amount_paid" in upd


async def pull_payments() -> int:
    linked = await db.documents.find({"kind": "invoice", "xero_invoice_id": {"$nin": ["", None]}, "status": {"$ne": "Paid"}},
                                     {"_id": 0}).to_list(5000)
    by_id = {i["xero_invoice_id"]: i for i in linked}
    ids = list(by_id)
    changed = 0
    for k in range(0, len(ids), 40):
        data = await xero("GET", "/Invoices", params={"IDs": ",".join(ids[k:k + 40])})
        for x in data.get("Invoices", []):
            if x["InvoiceID"] in by_id and await _apply_payment(by_id[x["InvoiceID"]], x):
                changed += 1
    return changed


async def sync_all() -> dict:
    imported = await import_contacts()
    customers = 0
    for c in await db.customers.find({"xero_contact_id": {"$in": ["", None]}}, {"_id": 0}).to_list(5000):
        # only push customers that have billable work, to keep Xero tidy
        if await db.documents.find_one({"kind": "invoice", "customer_id": c["id"], "status": {"$ne": "Draft"}}):
            await push_customer(c)
            customers += 1
    invoices = errors = 0
    for inv in await db.documents.find({"kind": "invoice", "status": {"$in": ["Sent", "Overdue"]},
                                        "xero_invoice_id": {"$in": ["", None]}}, {"_id": 0}).to_list(5000):
        try:
            await push_invoice(inv)
            invoices += 1
        except HTTPException as e:
            errors += 1
            logger.warning("Xero invoice sync failed for %s: %s", inv["number"], e.detail)
    payments = await pull_payments()
    result = {"imported_customers": imported, "pushed_customers": customers, "pushed_invoices": invoices,
              "invoice_errors": errors, "payments_updated": payments, "at": now_iso()}
    await db.xero_connection.update_one({"key": "primary"}, {"$set": {"last_sync": result}})
    await log_activity(f"Xero sync: {invoices} invoices, {customers + imported} customers, {payments} payments")
    return result

