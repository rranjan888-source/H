"""Generic CRUD router factory + the simple resources built on it."""

from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib.auth import get_current_user
from lib.common import find_one, log_activity, name_of, next_number
from lib.db import db
from models.crm import (
    Asset, AssetIn, Customer, CustomerIn, Form, FormIn, Lead, LeadIn, Leave, LeaveIn, Timesheet, TimesheetIn,
)

Prepare = Optional[Callable[[dict], Awaitable[None]]]


def crud_router(
    path: str,
    coll: str,
    Model: type[BaseModel],
    InModel: type[BaseModel],
    *,
    label: str,
    prepare: Prepare = None,
    number: Optional[Callable[[dict], str]] = None,
    base: Optional[dict] = None,
    sort: tuple[str, int] = ("created_at", -1),
) -> APIRouter:
    router = APIRouter(dependencies=[Depends(get_current_user)])
    flt = base or {}

    async def _get(id: str) -> dict:
        doc = await db[coll].find_one({"id": id, **flt}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        return doc

    @router.get(f"/{path}", response_model=list[Model])
    async def list_items():
        return await db[coll].find(flt, {"_id": 0}).sort(*sort).to_list(5000)

    @router.get(f"/{path}/{{id}}", response_model=Model)
    async def get_item(id: str):
        return await _get(id)

    @router.post(f"/{path}", response_model=Model)
    async def create_item(body: InModel):  # type: ignore[valid-type]
        data: dict[str, Any] = {**flt, **body.model_dump()}
        if number:
            data["number"] = await next_number(number(data))
        if prepare:
            await prepare(data)
        obj = Model(**data)
        await db[coll].insert_one(obj.model_dump())
        await log_activity(f"New {label.lower()} {data.get('number') or data.get('name', '')} created")
        return obj

    @router.put(f"/{path}/{{id}}", response_model=Model)
    async def update_item(id: str, body: InModel):  # type: ignore[valid-type]
        data = {**(await _get(id)), **body.model_dump()}
        if prepare:
            await prepare(data)
        obj = Model(**data)
        await db[coll].replace_one({"id": id}, obj.model_dump())
        return obj

    @router.delete(f"/{path}/{{id}}")
    async def delete_item(id: str):
        await _get(id)
        await db[coll].delete_one({"id": id})
        return {"ok": True}

    return router


# ---------- prepare hooks ----------
async def _user_name(d: dict) -> None:
    d["user_name"] = await name_of("users", d["user_id"])


async def _asset_prepare(d: dict) -> None:
    d["assigned_name"] = await name_of("users", d.get("assigned_to", ""))


async def _form_prepare(d: dict) -> None:
    job = await find_one("jobs", d.get("job_id", ""))
    if job:
        d["job_number"] = job["number"]
        d["customer_id"] = d.get("customer_id") or job["customer_id"]
    cust = await find_one("customers", d.get("customer_id", ""))
    d["customer_name"] = cust["name"] if cust else ""
    d["customer_address"] = cust["address"] if cust else ""
    d["technician_name"] = await name_of("users", d.get("technician_id", ""))


customers = crud_router("customers", "customers", Customer, CustomerIn, label="Customer", sort=("name", 1))
leads = crud_router("leads", "leads", Lead, LeadIn, label="Lead")
assets = crud_router("assets", "assets", Asset, AssetIn, label="Asset", prepare=_asset_prepare, sort=("name", 1))
timesheets = crud_router("timesheets", "timesheets", Timesheet, TimesheetIn, label="Timesheet entry",
                         prepare=_user_name, sort=("date", -1))
leave = crud_router("leave", "leave", Leave, LeaveIn, label="Leave request", prepare=_user_name,
                    sort=("start_date", 1))
forms = crud_router("forms", "forms", Form, FormIn, label="Form", prepare=_form_prepare,
                    number=lambda d: "GSC" if d["kind"] == "Certificate" else "FRM", sort=("date", -1))


# Lead → customer conversion
leads_extra = APIRouter(dependencies=[Depends(get_current_user)])


@leads_extra.post("/leads/{id}/convert", response_model=Customer)
async def convert_lead(id: str):
    lead = await find_one("leads", id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.get("customer_id"):
        cust = await find_one("customers", lead["customer_id"])
        if cust:
            return cust
    cust = Customer(name=lead["name"], contact_name=lead["contact_name"], phone=lead["phone"],
                    email=lead["email"], city=lead["city"], notes=lead["notes"])
    await db.customers.insert_one(cust.model_dump())
    await db.leads.update_one({"id": id}, {"$set": {"stage": "Won", "customer_id": cust.id}})
    await log_activity(f"Lead {lead['name']} converted to customer")
    return cust


ALL = [customers, leads, leads_extra, assets, timesheets, leave, forms]
