"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True),
              IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "customers": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("name", ASCENDING)], name="name"),
                  IndexModel([("xero_contact_id", ASCENDING)], name="xero_contact")],
    "xero_connection": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "xero_state": [IndexModel([("state", ASCENDING)], name="state")],
    "leads": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("created_at", DESCENDING)], name="created")],
    "documents": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                  IndexModel([("kind", ASCENDING), ("created_at", DESCENDING)], name="kind_created"),
                  IndexModel([("xero_invoice_id", ASCENDING)], name="xero_invoice")],
    "jobs": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("number", DESCENDING)], name="number"),
             IndexModel([("date", ASCENDING)], name="date")],
    "timesheets": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("date", DESCENDING)], name="date"),
                   IndexModel([("user_id", ASCENDING), ("open", ASCENDING)], name="user_open")],
    "leave": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("start_date", ASCENDING)], name="start")],
    "assets": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("name", ASCENDING)], name="name")],
    "forms": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("date", DESCENDING)], name="date")],
    "activity": [IndexModel([("created_at", DESCENDING)], name="created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
