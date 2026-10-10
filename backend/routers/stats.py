"""Dashboard + reports aggregates (computed in Python; data volumes are small)."""

from collections import Counter, defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from lib.auth import get_current_user
from lib.dates import today_iso
from lib.db import db
from models.crm import Activity, Dashboard, DayMoney, Document, Job, Kpi, NameValue, Reports

router = APIRouter(dependencies=[Depends(get_current_user)])


def _nv(counter: dict, order: list[str] | None = None) -> list[NameValue]:
    keys = order or sorted(counter, key=lambda k: -counter[k])
    return [NameValue(name=k, value=round(counter.get(k, 0), 2)) for k in keys]


async def _all(coll: str, flt: dict | None = None) -> list[dict]:
    return await db[coll].find(flt or {}, {"_id": 0}).to_list(10000)


def _outstanding(inv: dict) -> float:
    return round(inv["total"] - inv.get("amount_paid", 0), 2)


@router.get("/today")
async def today():
    return {"today": today_iso()}


@router.get("/activity", response_model=list[Activity])
async def activity():
    return await db.activity.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.get("/dashboard", response_model=Dashboard)
async def dashboard():
    today = today_iso()
    month = today[:7]
    jobs = await _all("jobs")
    docs = await _all("documents")
    invoices = [d for d in docs if d["kind"] == "invoice"]
    assets = await _all("assets")
    leads = await _all("leads")
    open_inv = [i for i in invoices if i["status"] in ("Sent", "Overdue")]
    paid_month = sum(i.get("amount_paid", 0) for i in invoices if (i.get("paid_at") or "")[:7] == month)
    kpis = [
        Kpi(label="Jobs in Progress", value=sum(j["status"] == "In Progress" for j in jobs)),
        Kpi(label="Quotes Sent", value=sum(d["kind"] == "quote" and d["status"] == "Sent" for d in docs)),
        Kpi(label="Invoices Outstanding", value=round(sum(_outstanding(i) for i in open_inv), 2), is_money=True),
        Kpi(label="Payments Received", value=round(paid_month, 2), is_money=True),
        Kpi(label="New Leads", value=sum(lead["stage"] == "New" for lead in leads)),
    ]
    start = date.fromisoformat(today) - timedelta(days=13)
    money_in: dict[str, float] = defaultdict(float)
    invoiced: dict[str, float] = defaultdict(float)
    for i in invoices:
        if i.get("paid_at"):
            money_in[i["paid_at"][:10]] += i.get("amount_paid", 0)
        if i["status"] != "Draft":
            invoiced[i["date"]] += i["total"]
    days = [(start + timedelta(days=n)).isoformat() for n in range(14)]
    money = [DayMoney(day=d, money_in=round(money_in[d], 2), invoiced=round(invoiced[d], 2)) for d in days]
    vehicles = Counter(a["status"] for a in assets if a["kind"] == "Vehicle")
    tools = Counter(a["status"] for a in assets if a["kind"] != "Vehicle")
    acts = await db.activity.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    return Dashboard(
        today=today,
        kpis=kpis,
        today_jobs=[Job(**j) for j in sorted((j for j in jobs if j["date"] == today), key=lambda j: j["start_time"])],
        jobs_by_status=_nv(Counter(j["status"] for j in jobs),
                           ["Completed", "In Progress", "Scheduled", "Pending", "Unscheduled"]),
        money=money,
        money_in_total=round(sum(m.money_in for m in money), 2),
        invoiced_total=round(sum(m.invoiced for m in money), 2),
        vehicles=_nv(Counter({"Total": len([a for a in assets if a["kind"] == "Vehicle"]), **vehicles})),
        tools=_nv(Counter({"Total": len([a for a in assets if a["kind"] != "Vehicle"]), **tools})),
        activity=acts,
    )


@router.get("/reports", response_model=Reports)
async def reports(start: str = "", end: str = ""):
    def in_range(d: str) -> bool:
        return (not start or d >= start) and (not end or d <= end)

    jobs = [j for j in await _all("jobs") if in_range(j["date"] or j["created_at"][:10])]
    invoices = [i for i in await _all("documents", {"kind": "invoice"}) if i["status"] != "Draft" and in_range(i["date"])]
    customers = {c["id"]: c for c in await _all("customers")}
    revenue = sum(i["subtotal"] for i in invoices)
    outstanding = [i for i in invoices if i["status"] != "Paid"]
    by_month: dict[str, float] = defaultdict(float)
    by_type: dict[str, float] = defaultdict(float)
    by_cust: dict[str, float] = defaultdict(float)
    for i in invoices:
        by_month[i["date"][:7]] += i["subtotal"]
        by_type[customers.get(i["customer_id"], {}).get("type", "Other")] += i["subtotal"]
        by_cust[i["customer_name"]] += i["subtotal"]
    t = date.fromisoformat(today_iso())
    months = []
    for n in range(11, -1, -1):
        y, m = divmod(t.year * 12 + t.month - 1 - n, 12)
        months.append(f"{y}-{m + 1:02d}")
    return Reports(
        kpis=[
            Kpi(label="Total Jobs", value=len(jobs)),
            Kpi(label="Revenue (ex GST)", value=round(revenue, 2), is_money=True),
            Kpi(label="Invoiced (incl GST)", value=round(sum(i["total"] for i in invoices), 2), is_money=True),
            Kpi(label="Outstanding", value=round(sum(_outstanding(i) for i in outstanding), 2), is_money=True),
            Kpi(label="Active Customers", value=sum(c["status"] == "Active" for c in customers.values())),
        ],
        revenue_by_month=[NameValue(name=m, value=round(by_month.get(m, 0), 2)) for m in months],
        jobs_by_type=_nv(Counter(j["job_type"] for j in jobs)),
        jobs_by_status=_nv(Counter(j["status"] for j in jobs)),
        revenue_by_customer_type=_nv(by_type),
        top_customers=_nv(by_cust)[:6],
        team_productivity=_nv(Counter(j["assigned_name"] for j in jobs if j["status"] == "Completed" and j["assigned_name"])),
        outstanding=[Document(**i) for i in sorted(outstanding, key=lambda i: i.get("due_date") or i["date"])],
    )
