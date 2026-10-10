"""Jobs & schedule, job → invoice, and timesheet clock in/out."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user
from lib.common import find_one, log_activity, name_of, next_number
from lib.dates import today_iso
from lib.db import db
from models.crm import ClockIn, Document, Job, JobIn, LineItem, Timesheet, now_iso
from routers.crud import crud_router
from routers.documents import _doc_prepare


async def _job_prepare(d: dict) -> None:
    cust = await find_one("customers", d["customer_id"])
    if not cust:
        raise HTTPException(status_code=400, detail="Customer not found")
    d["customer_name"] = cust["name"]
    d["customer_phone"] = cust["phone"]
    if not d.get("address"):
        d["address"] = ", ".join(x for x in [cust["address"], cust["city"]] if x)
    d["assigned_name"] = await name_of("users", d.get("assigned_to", ""))
    if d["status"] == "Unscheduled" and d.get("date") and d.get("assigned_to"):
        d["status"] = "Scheduled"
    if d["status"] == "Completed" and not d.get("completed_at"):
        d["completed_at"] = now_iso()
        await log_activity(f"Job {d.get('number', '')} completed", "completed")


jobs = crud_router("jobs", "jobs", Job, JobIn, label="Job", prepare=_job_prepare, number=lambda d: "J",
                   sort=("number", -1))
router = APIRouter()


@router.post("/jobs/{id}/invoice", response_model=Document)
async def job_to_invoice(id: str, _: dict = Depends(get_current_user)):
    job = await find_one("jobs", id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("invoice_id"):
        existing = await find_one("documents", job["invoice_id"])
        if existing:
            return existing
    src = None
    for key in ("sales_order_id", "quote_id"):
        if job.get(key):
            src = await find_one("documents", job[key])
            if src:
                break
    items = src["items"] if src else [LineItem(description=job["job_type"], detail=job["description"],
                                                unit_price=job.get("value", 0)).model_dump()]
    data = {
        "kind": "invoice", "number": await next_number("INV"), "customer_id": job["customer_id"],
        "site_address": job["address"], "date": today_iso(), "reference": f"{job['number']} {job['job_type']}",
        "assigned_to": job.get("assigned_to", ""), "items": items, "status": "Draft",
        "terms": "Payment is due 7 days from invoice date.", "job_id": job["id"], "job_number": job["number"],
        "quote_id": job.get("quote_id", ""), "quote_number": job.get("quote_number", ""),
        "sales_order_id": job.get("sales_order_id", ""),
    }
    await _doc_prepare(data)
    inv = Document(**data)
    await db.documents.insert_one(inv.model_dump())
    await db.jobs.update_one({"id": id}, {"$set": {"invoice_id": inv.id, "invoice_number": inv.number}})
    if job.get("sales_order_id"):
        await db.documents.update_one({"id": job["sales_order_id"]}, {"$set": {"status": "Invoiced"}})
    await log_activity(f"Invoice {inv.number} created from job {job['number']}")
    return inv


# ---------- clock in / out (current user) ----------
@router.get("/clock/status", response_model=Timesheet | None)
async def clock_status(user: dict = Depends(get_current_user)):
    return await db.timesheets.find_one({"user_id": user["id"], "open": True}, {"_id": 0})


@router.post("/clock/in", response_model=Timesheet)
async def clock_in(body: ClockIn, user: dict = Depends(get_current_user)):
    if await db.timesheets.find_one({"user_id": user["id"], "open": True}):
        raise HTTPException(status_code=400, detail="Already clocked in")
    entry = Timesheet(user_id=user["id"], user_name=user["name"], date=today_iso(), hours=0, type=body.type,
                      job_number=body.job_number, activity=body.activity or "Clocked in",
                      clock_in=now_iso(), open=True)
    await db.timesheets.insert_one(entry.model_dump())
    return entry


@router.post("/clock/out", response_model=Timesheet)
async def clock_out(user: dict = Depends(get_current_user)):
    entry = await db.timesheets.find_one({"user_id": user["id"], "open": True}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=400, detail="Not clocked in")
    started = datetime.fromisoformat(entry["clock_in"])
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    hours = max(round((datetime.now(timezone.utc) - started).total_seconds() / 3600, 2), 0.01)
    await db.timesheets.update_one({"id": entry["id"]}, {"$set": {"open": False, "hours": hours}})
    await log_activity(f"{user['name']} logged {hours:g}h")
    return Timesheet(**{**entry, "open": False, "hours": hours})


ALL = [router, jobs]
