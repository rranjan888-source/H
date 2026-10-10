"""Shared helpers: numbering, activity log, lookups, document totals."""

from pymongo import ReturnDocument

from lib.db import db
from models.crm import Activity


START = {"J": 2000}


async def next_number(prefix: str, start: int | None = None) -> str:
    start = start if start is not None else START.get(prefix, 1000)
    doc = await db.counters.find_one_and_update(
        {"_id": prefix}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"{prefix}-{start + doc['seq']}"


async def log_activity(message: str, kind: str = "info") -> None:
    await db.activity.insert_one(Activity(message=message, kind=kind).model_dump())


async def find_one(coll: str, id: str) -> dict | None:
    if not id:
        return None
    return await db[coll].find_one({"id": id}, {"_id": 0})


async def name_of(coll: str, id: str) -> str:
    doc = await find_one(coll, id)
    return doc["name"] if doc else ""


def compute_totals(items: list[dict]) -> dict:
    subtotal = 0.0
    gst_total = 0.0
    for it in items:
        line = it["qty"] * it["unit_price"] * (1 - it.get("discount", 0) / 100)
        subtotal += line
        gst_total += line * it.get("gst", 15) / 100
    return {
        "subtotal": round(subtotal, 2),
        "gst_total": round(gst_total, 2),
        "total": round(subtotal + gst_total, 2),
    }
