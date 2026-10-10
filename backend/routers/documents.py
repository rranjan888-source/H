"""Quotes, sales orders and invoices (one `documents` collection keyed by `kind`), plus the
public quote-acceptance flow that auto-creates a job."""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request

from lib import xero
from lib.auth import get_current_user
from lib.common import compute_totals, find_one, log_activity, name_of, next_number
from lib.dates import today_iso
from lib.db import db
from lib.email import document_email_html, send_email
from models.crm import (
    AcceptIn, ChecklistItem, Company, Customer, Document, DocumentIn, Job, PaymentIn, PublicQuote, now_iso,
)
from routers.crud import crud_router

logger = logging.getLogger(__name__)
KIND_PREFIX = {"quote": "Q", "sales_order": "SO", "invoice": "INV"}
KIND_LABEL = {"quote": "Quote", "sales_order": "Sales order", "invoice": "Invoice"}
DEFAULT_CHECKLIST = ["Arrived on site", "Safety check", "Work completed", "Test and commission", "Customer sign-off"]


async def _doc_prepare(d: dict) -> None:
    cust = await find_one("customers", d["customer_id"])
    if not cust:
        raise HTTPException(status_code=400, detail="Customer not found")
    d["customer_name"] = cust["name"]
    d["customer_email"] = cust["email"]
    if not d.get("site_address"):
        d["site_address"] = ", ".join(x for x in [cust["address"], cust["city"]] if x)
    d["assigned_name"] = await name_of("users", d.get("assigned_to", ""))
    d.update(compute_totals(d["items"]))


def _doc_router(path: str, kind: str):
    return crud_router(path, "documents", Document, DocumentIn, label=KIND_LABEL[kind], prepare=_doc_prepare,
                       number=lambda d: KIND_PREFIX[d["kind"]], base={"kind": kind})


quotes = _doc_router("quotes", "quote")
sales_orders = _doc_router("sales-orders", "sales_order")
invoices = _doc_router("invoices", "invoice")

router = APIRouter(dependencies=[Depends(get_current_user)])
public = APIRouter()


async def _get_doc(id: str, kind: str) -> dict:
    doc = await db.documents.find_one({"id": id, "kind": kind}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"{KIND_LABEL[kind]} not found")
    return doc


async def _new_doc(src: dict, kind: str, **extra) -> Document:
    fields = {k: src[k] for k in DocumentIn.model_fields if k in src}
    data = {**fields, "kind": kind, "number": await next_number(KIND_PREFIX[kind]), "date": today_iso(), **extra}
    await _doc_prepare(data)
    doc = Document(**data)
    await db.documents.insert_one(doc.model_dump())
    return doc


async def create_job_from(doc: dict, status: str = "Unscheduled") -> Job:
    cust = await find_one("customers", doc["customer_id"]) or {}
    items = doc.get("items", [])
    job = Job(
        number=await next_number("J", 2000),
        customer_id=doc["customer_id"],
        customer_name=doc["customer_name"],
        customer_phone=cust.get("phone", ""),
        address=doc.get("site_address", ""),
        job_type=items[0]["description"] if items else (doc.get("reference") or "Service"),
        description=doc.get("reference", "") + ("\n" if doc.get("reference") else "")
        + "; ".join(i["description"] for i in items),
        priority="Medium",
        status=status,
        assigned_to=doc.get("assigned_to", ""),
        assigned_name=doc.get("assigned_name", ""),
        checklist=[ChecklistItem(label=x) for x in DEFAULT_CHECKLIST],
        quote_id=doc["id"] if doc["kind"] == "quote" else doc.get("quote_id", ""),
        quote_number=doc["number"] if doc["kind"] == "quote" else doc.get("quote_number", ""),
        sales_order_id=doc["id"] if doc["kind"] == "sales_order" else "",
        value=doc.get("subtotal", 0),
    )
    await db.jobs.insert_one(job.model_dump())
    await db.documents.update_one({"id": doc["id"]}, {"$set": {"job_id": job.id, "job_number": job.number}})
    return job


def _app_url(request: Request) -> str:
    origin = request.headers.get("origin", "")
    if origin.startswith("https://"):
        return origin.rstrip("/")
    return os.environ.get("PUBLIC_APP_URL", "").rstrip("/")


def _check_recipient(email: str) -> None:
    domain = email.split("@")[-1].lower() if "@" in email else ""
    if not domain or "example" in domain.split("."):
        raise HTTPException(status_code=400,
                            detail="Customer has no deliverable email address. Update the customer's email first.")


def _rows(doc: dict) -> list[tuple[str, str]]:
    return [(f"{i['description']} x {i['qty']:g}", f"${i['qty'] * i['unit_price']:,.2f}") for i in doc["items"]]


@router.post("/quotes/{id}/send", response_model=Document)
async def send_quote(id: str, request: Request):
    q = await _get_doc(id, "quote")
    cust = await find_one("customers", q["customer_id"]) or {}
    _check_recipient(cust.get("email", ""))
    link = f"{_app_url(request)}/public/quote/{q['id']}"
    html = document_email_html(
        greeting_name=cust.get("contact_name") or cust.get("name", ""),
        heading=f"Quote {q['number']}",
        intro=q.get("message") or "Please find our quote below. You can review and accept it online.",
        rows=_rows(q), total=f"${q['total']:,.2f}", link=link, link_label="View & accept quote",
    )
    await send_email(to=cust["email"], subject=f"Quote {q['number']} from GasCraft Ltd", html=html)
    upd = {"sent_at": now_iso()}
    if q["status"] == "Draft":
        upd["status"] = "Sent"
    await db.documents.update_one({"id": id}, {"$set": upd})
    await log_activity(f"Quote {q['number']} sent to {cust['email']}")
    return Document(**{**q, **upd})


@router.post("/invoices/{id}/send", response_model=Document)
async def send_invoice(id: str):
    inv = await _get_doc(id, "invoice")
    cust = await find_one("customers", inv["customer_id"]) or {}
    _check_recipient(cust.get("email", ""))
    html = document_email_html(
        greeting_name=cust.get("contact_name") or cust.get("name", ""),
        heading=f"Invoice {inv['number']}",
        intro=f"Please find your invoice below. Payment is due by {inv.get('due_date') or 'the due date'}.",
        rows=_rows(inv), total=f"${inv['total']:,.2f}", link=None, link_label="",
    )
    await send_email(to=cust["email"], subject=f"Invoice {inv['number']} from GasCraft Ltd", html=html)
    upd = {"sent_at": now_iso()}
    if inv["status"] == "Draft":
        upd["status"] = "Sent"
    await db.documents.update_one({"id": id}, {"$set": upd})
    await log_activity(f"Invoice {inv['number']} sent to {cust['email']}")
    if xero.configured() and await xero.connection():  # auto-sync sent invoices; never block the send
        try:
            await xero.push_invoice({**inv, **upd})
        except HTTPException as e:
            logger.warning("Auto Xero sync failed for %s: %s", inv["number"], e.detail)
    return await _get_doc(id, "invoice")


@router.post("/quotes/{id}/convert", response_model=Document)
async def convert_quote(id: str):
    q = await _get_doc(id, "quote")
    if q.get("sales_order_id"):
        return await _get_doc(q["sales_order_id"], "sales_order")
    so = await _new_doc(q, "sales_order", status="Confirmed", quote_id=q["id"], quote_number=q["number"],
                        due_date=q.get("due_date", ""), job_id=q.get("job_id", ""), job_number=q.get("job_number", ""))
    await db.documents.update_one({"id": id}, {"$set": {"status": "Converted", "sales_order_id": so.id,
                                                        "sales_order_number": so.number}})
    if q.get("job_id"):
        await db.jobs.update_one({"id": q["job_id"]}, {"$set": {"sales_order_id": so.id}})
    await log_activity(f"Quote {q['number']} converted to sales order {so.number}")
    return so


@router.post("/quotes/{id}/job", response_model=Job)
@router.post("/sales-orders/{id}/job", response_model=Job)
async def doc_to_job(id: str):
    doc = await db.documents.find_one({"id": id, "kind": {"$in": ["quote", "sales_order"]}}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("job_id"):
        existing = await find_one("jobs", doc["job_id"])
        if existing:
            return existing
    job = await create_job_from(doc)
    if doc["kind"] == "sales_order" and doc["status"] == "Confirmed":
        await db.documents.update_one({"id": id}, {"$set": {"status": "In Progress"}})
    await log_activity(f"Job {job.number} created from {doc['number']}")
    return job


@router.post("/sales-orders/{id}/invoice", response_model=Document)
async def so_to_invoice(id: str):
    so = await _get_doc(id, "sales_order")
    inv = await _new_doc(so, "invoice", status="Draft", sales_order_id=so["id"], sales_order_number=so["number"],
                         quote_id=so.get("quote_id", ""), quote_number=so.get("quote_number", ""),
                         job_id=so.get("job_id", ""), job_number=so.get("job_number", ""), due_date="")
    await db.documents.update_one({"id": id}, {"$set": {"status": "Invoiced"}})
    if so.get("job_id"):
        await db.jobs.update_one({"id": so["job_id"]}, {"$set": {"invoice_id": inv.id, "invoice_number": inv.number}})
    await log_activity(f"Invoice {inv.number} created from {so['number']}")
    return inv


@router.post("/invoices/{id}/payment", response_model=Document)
async def record_payment(id: str, body: PaymentIn):
    inv = await _get_doc(id, "invoice")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    paid = round(inv.get("amount_paid", 0) + body.amount, 2)
    upd: dict = {"amount_paid": paid}
    if paid >= inv["total"] - 0.005:
        upd.update(status="Paid", paid_at=now_iso())
    await db.documents.update_one({"id": id}, {"$set": upd})
    await log_activity(f"Payment of ${body.amount:,.2f} received for {inv['number']}", "payment")
    return Document(**{**inv, **upd})


# ---------- public (no auth) ----------
@public.get("/public/quotes/{id}", response_model=PublicQuote)
async def public_quote(id: str):
    q = await _get_doc(id, "quote")
    if q["status"] == "Draft":
        raise HTTPException(status_code=404, detail="Quote not found")
    cust = await find_one("customers", q["customer_id"])
    return PublicQuote(quote=Document(**q), customer=Customer(**cust), company=Company())


@public.post("/public/quotes/{id}/accept", response_model=PublicQuote)
async def public_accept(id: str, body: AcceptIn):
    q = await _get_doc(id, "quote")
    if q["status"] == "Draft":
        raise HTTPException(status_code=404, detail="Quote not found")
    if q["status"] not in ("Sent", "Accepted", "Converted"):
        raise HTTPException(status_code=400, detail=f"Quote is {q['status']} and cannot be accepted")
    if not body.name.strip() or not body.signature.strip():
        raise HTTPException(status_code=400, detail="Name and signature are required")
    if q["status"] == "Sent":
        upd = {"status": "Accepted", "accepted_at": now_iso(), "accepted_by": body.name.strip()}
        await db.documents.update_one({"id": id}, {"$set": upd})
        q.update(upd)
        await log_activity(f"Quote {q['number']} accepted online by {body.name.strip()}", "accepted")
        if not q.get("job_id"):
            job = await create_job_from(q)
            q.update(job_id=job.id, job_number=job.number)
            await log_activity(f"Job {job.number} auto-created for scheduling from {q['number']}")
    cust = await find_one("customers", q["customer_id"])
    return PublicQuote(quote=Document(**q), customer=Customer(**cust), company=Company())


ALL = [quotes, sales_orders, invoices, router, public]
