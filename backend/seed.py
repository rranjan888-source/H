"""Seed realistic NZ GasCraft data. Idempotent: wipes CRM collections and re-inserts.
Run: cd /app/backend && python seed.py"""

import asyncio
from datetime import date, datetime, timedelta, timezone

from lib.auth import hash_password
from lib.common import compute_totals
from lib.dates import today_iso
from lib.db import db, ensure_indexes
from models.crm import (
    Activity, Asset, ChecklistItem, Customer, Document, Form, Job, Lead, Leave, LineItem, Timesheet, User,
)

T = date.fromisoformat(today_iso("Pacific/Auckland"))


def d(n: int) -> str:
    return (T + timedelta(days=n)).isoformat()


def ts(n_days: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=n_days)).isoformat()


COLLS = ["users", "customers", "leads", "documents", "jobs", "timesheets", "leave", "assets", "forms",
         "activity", "counters"]


async def main():
    for c in COLLS:
        await db[c].drop()
    await ensure_indexes()

    # ---------- users ----------
    U = {}
    staff = [
        ("Ranjan Patel", "admin@gascraft.co.nz", "admin", "Administrator", "021 400 1000", "Active", "", "Admin@123"),
        ("Michael Brown", "michael@gascraft.co.nz", "technician", "Senior Technician", "021 555 0198", "Active", "GAS-01", "Tech@123"),
        ("Emma Wilson", "emma@gascraft.co.nz", "technician", "Technician", "027 234 5678", "Active", "GAS-02", "Tech@123"),
        ("David Lee", "david@gascraft.co.nz", "technician", "Technician", "021 987 6543", "Active", "GAS-03", "Tech@123"),
        ("Sarah Johnson", "sarah@gascraft.co.nz", "technician", "Technician", "027 456 7890", "Active", "GAS-04", "Tech@123"),
        ("Chris Taylor", "chris@gascraft.co.nz", "technician", "Technician", "021 333 2211", "On Leave", "GAS-05", "Tech@123"),
        ("John Smith", "john.smith@gascraft.co.nz", "technician", "Apprentice", "021 444 6677", "Active", "GAS-06", "Tech@123"),
        ("Lisa Chen", "lisa@gascraft.co.nz", "admin", "Office/Admin", "07 834 2201", "Active", "", "Admin@123"),
    ]
    for name, email, role, title, phone, status, veh, pw in staff:
        u = User(name=name, email=email, role=role, title=title, phone=phone, status=status, vehicle=veh)
        await db.users.insert_one({**u.model_dump(), "password_hash": hash_password(pw)})
        U[name.split()[0]] = u

    # ---------- customers ----------
    C = {}
    custs = [
        ("ABC Manufacturing Ltd", "Commercial", "John Smith", "021 555 0198", "john@abc.example.co.nz", "123 Main Road", "Hamilton 3200", "Active", "123-456-789", "20th of month", 10000, "Key customer. Annual boiler service contract. Preferred contact John for all service bookings."),
        ("Smith Residence", "Residential", "Sarah Smith", "027 123 4567", "sarah@smith.example.co.nz", "45 River Road", "Hamilton 3200", "Active", "", "7 days", 0, ""),
        ("Taylor Industries", "Commercial", "Mark Taylor", "021 987 6543", "mark@taylor.example.co.nz", "8 Glenview Street", "Tauranga 3110", "Active", "234-567-890", "20th of month", 8000, ""),
        ("Greenfield Property", "Commercial", "Lisa Green", "027 456 7890", "lisa@greenfield.example.co.nz", "22 Park Road", "Auckland 1010", "Active", "345-678-901", "20th of month", 15000, "Property manager for 14 sites."),
        ("Wilson Home", "Residential", "David Wilson", "021 333 2211", "david@wilson.example.co.nz", "15 Sunshine Avenue", "Cambridge 3434", "Active", "", "7 days", 0, ""),
        ("Harris Residence", "Residential", "Karen Harris", "027 765 4321", "karen@harris.example.co.nz", "6 Tui Street", "Hamilton 3210", "Active", "", "7 days", 0, ""),
        ("Bayview Apartments", "Commercial", "Steve Clarke", "021 888 7766", "steve@bayview.example.co.nz", "200 Marine Parade", "Tauranga 3116", "Active", "456-789-012", "20th of month", 12000, ""),
        ("Rogers Family", "Residential", "Michael Rogers", "021 234 5678", "mike@rogers.example.co.nz", "9 Kowhai Street", "Hamilton 3216", "Inactive", "", "7 days", 0, ""),
        ("Central Realty", "Commercial", "Amy Carter", "027 555 8899", "amy@centralrealty.example.co.nz", "100 Victoria Street", "Auckland 1010", "Active", "567-890-123", "20th of month", 6000, ""),
        ("Elite Construction", "Commercial", "Chris Allen", "021 444 6677", "chris@elite.example.co.nz", "112 Tramway Road", "Hamilton 3200", "Active", "678-901-234", "20th of month", 20000, ""),
    ]
    for i, (name, typ, contact, phone, email, addr, city, status, gst, terms, credit, notes) in enumerate(custs):
        c = Customer(name=name, type=typ, contact_name=contact, phone=phone, email=email, address=addr, city=city,
                     status=status, gst_number=gst, payment_terms=terms, credit_limit=credit, notes=notes,
                     website="", created_at=ts(-500 + i * 30))
        await db.customers.insert_one(c.model_dump())
        C[name.split()[0]] = c

    # ---------- leads ----------
    for name, contact, src, svc, val, stage, city, n in [
        ("Hillcrest Dental", "Dr Priya Nair", "Website", "Heat pump installation", 6800, "New", "Hamilton", -0.2),
        ("Kowhai Kindergarten", "Jo Mason", "Referral", "Gas safety check", 450, "New", "Cambridge", -1),
        ("Riverside Cafe", "Tom Ngata", "Phone", "Commercial cooktop install", 3200, "Contacted", "Hamilton", -3),
        ("Morrinsville Motors", "Gary Holt", "Website", "Workshop heating", 12500, "Qualified", "Morrinsville", -6),
        ("Te Awa Lodge", "Mere Walker", "Facebook", "Hot water cylinder", 4100, "New", "Taupo", -2),
        ("Pukete Pharmacy", "Ben Shaw", "Referral", "Annual service contract", 1800, "Lost", "Hamilton", -20),
    ]:
        await db.leads.insert_one(Lead(name=name, contact_name=contact, source=src, service=svc, value=val,
                                       stage=stage, city=city, phone="021 000 1234",
                                       email=f"{contact.split()[-1].lower()}@lead.example.co.nz",
                                       created_at=ts(n)).model_dump())

    # ---------- documents ----------
    std = [LineItem(description="Boiler Service", detail="Annual boiler service and safety inspection", unit_price=450),
           LineItem(description="Pressure Test", detail="Pressure test & safety check", unit_price=180),
           LineItem(description="Gas Safety Check", detail="Gas safety inspection", unit_price=120),
           LineItem(description="Travel", detail="Travel & call out", unit_price=90)]
    terms = ("1. This quote is valid for 14 days from the date of issue.\n2. All work will be carried out in accordance "
             "with NZ standards.\n3. Prices are exclusive of any additional works not specified.\n4. Payment is due 7 days "
             "from invoice date.\n5. This quote is subject to site inspection if required.")

    async def doc(kind, number, cust, items, status, date_, due, ref, assigned, **kw):
        items_d = [i.model_dump() for i in items]
        o = Document(kind=kind, number=number, customer_id=cust.id, customer_name=cust.name, customer_email=cust.email,
                     site_address=f"{cust.address}, {cust.city}", date=date_, due_date=due, reference=ref,
                     assigned_to=assigned.id if assigned else "", assigned_name=assigned.name if assigned else "",
                     items=items, status=status, terms=terms, tags=kw.pop("tags", []),
                     message=f"Hi {cust.contact_name.split()[0]},\nPlease find our quote below. If you have any questions, feel free to get in touch.\nKind regards,\nGasCraft Ltd" if kind == "quote" else "",
                     **compute_totals(items_d), **kw)
        await db.documents.insert_one(o.model_dump())
        return o

    hp = [LineItem(description="Heat Pump Installation", detail="Supply & install 8kW high-wall heat pump", unit_price=3850),
          LineItem(description="Removal of old unit", unit_price=250), LineItem(description="Electrical connection", unit_price=420)]
    hw = [LineItem(description="Hot Water Cylinder Install", detail="180L mains pressure gas cylinder", unit_price=2650),
          LineItem(description="Gas Certificate", unit_price=95)]
    q1 = await doc("quote", "Q-1024", C["ABC"], std, "Sent", d(0), d(14), "Boiler Service 2025", U["Michael"],
                   sent_at=ts(-0.01), internal_notes="Customer requested service during shutdown period. Prefer morning works.",
                   tags=["Boiler", "Annual Service", "Commercial"])
    await doc("quote", "Q-1025", C["Harris"], hp, "Draft", d(0), d(14), "Lounge heat pump", U["Emma"])
    await doc("quote", "Q-1023", C["Wilson"], hw, "Sent", d(-3), d(11), "Cylinder replacement", U["David"], sent_at=ts(-3))
    q0 = await doc("quote", "Q-1022", C["Taylor"], std, "Converted", d(-6), d(8), "Plant boiler service", U["Michael"],
                   sent_at=ts(-6), accepted_at=ts(-5), accepted_by="Mark Taylor")
    so = await doc("sales_order", "SO-1024", C["Taylor"], std, "Confirmed", d(-5), d(4), "Plant boiler service",
                   U["Michael"], quote_id=q0.id, quote_number=q0.number,
                   internal_notes="Coordinate with site manager.", tags=["Boiler", "Commercial"])
    await db.documents.update_one({"id": q0.id}, {"$set": {"sales_order_id": so.id, "sales_order_number": so.number}})

    invs = [
        ("INV-3008", "Greenfield", std, "Paid", -12, U["Sarah"]),
        ("INV-3009", "Bayview", hw, "Paid", -9, U["David"]),
        ("INV-3010", "Elite", hp, "Paid", -6, U["Emma"]),
        ("INV-3011", "ABC", std, "Sent", -4, U["Michael"]),
        ("INV-3012", "Central", hw, "Sent", -1, U["David"]),
        ("INV-3013", "Smith", hp, "Overdue", -25, U["Emma"]),
        ("INV-3014", "Harris", std[:2], "Draft", 0, U["Sarah"]),
    ]
    for number, ck, items, status, n, tech in invs:
        tot = compute_totals([i.model_dump() for i in items])
        paid = status == "Paid"
        await doc("invoice", number, C[ck], items, status, d(n), d(n + 7), f"{items[0].description}", tech,
                  amount_paid=tot["total"] if paid else 0, paid_at=ts(n + 2) if paid else None,
                  sent_at=ts(n) if status != "Draft" else None)
    # historic invoices for 12-month revenue trend
    hist_c = list(C.values())
    for m in range(1, 12):
        for k in range(3):
            c = hist_c[(m + k) % len(hist_c)]
            items = [std, hp, hw][k]
            ddate = (T.replace(day=1) - timedelta(days=30 * m - 5 * k)).isoformat()
            tot = compute_totals([i.model_dump() for i in items])
            await doc("invoice", f"INV-{2900 + m * 3 + k}", c, items, "Paid", ddate, ddate, items[0].description, None,
                      amount_paid=tot["total"], paid_at=ddate + "T02:00:00+00:00", sent_at=ddate + "T01:00:00+00:00")

    # ---------- jobs ----------
    def checklist(done: int):
        labels = ["Arrived on site", "Remove old unit", "Install new unit", "Test and commission", "Customer sign-off"]
        return [ChecklistItem(label=l, done=i < done) for i, l in enumerate(labels)]

    J = {}
    jobs = [
        # number, cust, type, tech, day, time, dur, status, priority, done, addr
        ("J-2015", "ABC", "Boiler Service", "Michael", 0, "09:00", 1.5, "In Progress", "High", 2, ""),
        ("J-2016", "Smith", "Heat Pump Installation", "Emma", 0, "09:30", 2, "In Progress", "Medium", 3, ""),
        ("J-2017", "Harris", "Gas Safety Check", "Emma", 0, "13:00", 1, "Scheduled", "Medium", 0, ""),
        ("J-2018", "Wilson", "Hot Water Repair", "Michael", 0, "13:30", 2, "Pending", "Medium", 0, ""),
        ("J-2019", "Greenfield", "Annual Heating Service", "Michael", 0, "15:30", 1.5, "Scheduled", "Low", 0, ""),
        ("J-2020", "Bayview", "Maintenance", "David", 0, "09:00", 2, "Scheduled", "Medium", 0, ""),
        ("J-2021", "Elite", "Boiler Service", "David", 0, "11:30", 1.5, "Scheduled", "High", 0, ""),
        ("J-2022", "Central", "Gas Leak Check", "David", 0, "15:00", 1, "Scheduled", "High", 0, ""),
        ("J-2023", "Taylor", "Heat Pump Service", "Sarah", 0, "10:45", 1.5, "Scheduled", "Medium", 0, ""),
        ("J-2024", "Wilson", "Hot Water Cylinder Install", "Sarah", 0, "14:00", 3, "Scheduled", "Medium", 0, ""),
        ("J-2025", "ABC", "Gas Fire Maintenance", "John", 1, "09:00", 2, "Scheduled", "Low", 0, ""),
        ("J-2026", "Greenfield", "Safety Check", "Emma", 1, "10:00", 1, "Scheduled", "Medium", 0, ""),
        ("J-2027", "Bayview", "Boiler Service", "Michael", 2, "08:30", 2, "Scheduled", "Medium", 0, ""),
        ("J-2030", "Greenfield", "Boiler Service", "", 1, "", 2, "Unscheduled", "High", 0, "22 Park Road, Auckland 1010"),
        ("J-2031", "Taylor", "Maintenance", "", 1, "", 2, "Unscheduled", "Medium", 0, ""),
        ("J-2032", "Wilson", "Hot Water Repair", "", 2, "", 1.5, "Unscheduled", "Medium", 0, ""),
        ("J-2033", "Central", "Gas Safety Check", "", 2, "", 1, "Unscheduled", "High", 0, ""),
        ("J-2034", "Harris", "Heat Pump Service", "", 3, "", 1.5, "Unscheduled", "Low", 0, ""),
    ]
    past_types = ["Boiler Service", "Heat Pump Installation", "Hot Water Repair", "Gas Safety Check", "Maintenance"]
    techs = ["Michael", "Emma", "David", "Sarah", "Chris"]
    for k in range(20):
        jobs.append((f"J-{1990 + k}" if k < 10 else f"J-{2000 + k - 10}", list(C)[k % 10], past_types[k % 5],
                     techs[k % 5], -(k * 3 + 1), "09:00", 2, "Completed", "Medium", 5, ""))
    for number, ck, jt, tech, day, time, dur, status, prio, done, addr in jobs:
        cust = C[ck]
        unsched = status == "Unscheduled"
        j = Job(number=number, customer_id=cust.id, customer_name=cust.name, customer_phone=cust.phone,
                address=addr or f"{cust.address}, {cust.city}", job_type=jt,
                description=f"{jt} at {cust.name}. Check operation, clean, test and issue certificate.",
                priority=prio, status=status, date="" if unsched else d(day), start_time=time, duration_hours=dur,
                assigned_to=U[tech].id if tech else "", assigned_name=U[tech].name if tech else "",
                checklist=checklist(done), value=[840, 4520, 380, 120, 560][len(J) % 5],
                completed_at=ts(day) if status == "Completed" else None, created_at=ts(min(day, 0) - 2))
        await db.jobs.insert_one(j.model_dump())
        J[number] = j
    await db.documents.update_one({"id": q0.id}, {"$set": {"job_id": J["J-2023"].id, "job_number": "J-2023"}})
    await db.documents.update_one({"id": so.id}, {"$set": {"job_id": J["J-2023"].id, "job_number": "J-2023"}})

    # ---------- timesheets (this week) ----------
    monday = T - timedelta(days=T.weekday())
    for idx, key in enumerate(["Michael", "Emma", "David", "Sarah", "John", "Lisa"]):
        for wd in range(5):
            day = monday + timedelta(days=wd)
            if day > T or (key == "Sarah" and wd == 3):
                continue
            hrs = [8, 8, 7.5, 8, 7][(idx + wd) % 5]
            billable = key != "Lisa"
            await db.timesheets.insert_one(Timesheet(
                user_id=U[key].id, user_name=U[key].name, date=day.isoformat(),
                hours=hrs - (1 if billable else 0), type="Billable" if billable else "Non-Billable",
                job_number=f"J-20{15 + (idx + wd) % 12}" if billable else "",
                activity="On site works" if billable else "Office administration").model_dump())
            if billable:
                await db.timesheets.insert_one(Timesheet(
                    user_id=U[key].id, user_name=U[key].name, date=day.isoformat(), hours=1, type="Travel",
                    activity="Travel between sites").model_dump())

    for key, typ, s, e, st in [("Chris", "Annual Leave", 0, 4, "Approved"), ("Sarah", "Annual Leave", 3, 3, "Approved"),
                               ("John", "Sick Leave", 9, 9, "Pending"), ("Emma", "RDO", 17, 17, "Approved")]:
        await db.leave.insert_one(Leave(user_id=U[key].id, user_name=U[key].name, type=typ, start_date=d(s),
                                        end_date=d(e), status=st).model_dump())

    # ---------- assets ----------
    assets = [
        ("Toyota HiAce GAS-01", "Vehicle", "GAS-01", "KQZ458", "Vans", "Toyota", "HiAce", "Michael", "Hamilton", "On Road", 30, 30, 94, None),
        ("Ford Ranger GAS-02", "Vehicle", "GAS-02", "PLT236", "Utes", "Ford", "Ranger", "Emma", "Tauranga", "On Road", 46, 12, 120, None),
        ("Isuzu D-Max GAS-03", "Vehicle", "GAS-03", "NBF391", "Utes", "Isuzu", "D-Max", "David", "Auckland", "In Service", 2, 60, 200, None),
        ("Toyota HiAce GAS-04", "Vehicle", "GAS-04", "RTX902", "Vans", "Toyota", "HiAce", "Sarah", "Hamilton", "On Road", 75, -3, 40, None),
        ("Mitsubishi Triton GAS-05", "Vehicle", "GAS-05", "MHT774", "Utes", "Mitsubishi", "Triton", "Chris", "Hamilton", "Off Road", -5, 150, 80, None),
        ("Testo 300 Flue Gas Analyser", "Tool", "T300-4587", "0563 3004", "Testing Equipment", "Testo", "Testo 300", "", "Hamilton Depot", "Available", 7, None, None, 7),
        ("Fieldpiece SMAN460 Digital Manifold", "Tool", "SM460-221", "SM460221", "Testing Equipment", "Fieldpiece", "SMAN460", "Sarah", "Tauranga", "In Use", 30, None, None, 30),
        ("Makita Drill Kit 18V Brushless", "Equipment", "MKD-7821", "MK78210", "Power Tools", "Makita", "DHP486", "John", "Van 2", "Available", None, None, None, None),
        ("Extension Ladder 3.6m Aluminium", "Equipment", "LAD-1023", "LAD1023", "Access", "Bailey", "Pro 3.6", "Emma", "Auckland", "In Use", None, None, None, None),
        ("Refrigerant Recovery Unit MR45", "Tool", "MR45-556", "MR45556", "Refrigeration", "Fieldpiece", "MR45", "David", "Hamilton", "Available", 36, None, None, 36),
        ("Tool Box Heavy Duty", "Equipment", "TB-0091", "TB0091", "Storage", "Stanley", "FatMax", "Michael", "Van 1", "Available", None, None, None, None),
        ("Gas Leak Detector CPS LS790B", "Tool", "LS790-332", "LS790332", "Testing Equipment", "CPS", "LS790B", "Michael", "Auckland", "Calibration Due", -3, None, None, -3),
        ("Digital Manometer Testo 510", "Tool", "T510-118", "T510118", "Testing Equipment", "Testo", "510i", "Michael", "Van 1", "In Use", 120, None, None, 120),
        ("Pipe Press Tool Rothenberger", "Equipment", "RP-4410", "RP4410", "Power Tools", "Rothenberger", "Romax 4000", "", "Hamilton Depot", "In Service", 10, None, None, None),
    ]
    for name, kind, code, serial, cat, brand, model, tech, loc, status, svc, wof, rego, cal in assets:
        await db.assets.insert_one(Asset(
            name=name, kind=kind, asset_code=code, serial=serial, category=cat, brand=brand, model=model,
            assigned_to=U[tech].id if tech else "", assigned_name=U[tech].name if tech else "", location=loc,
            status=status, next_service=d(svc) if svc is not None else "", wof_expiry=d(wof) if wof is not None else "",
            rego_expiry=d(rego) if rego is not None else "", calibration_due=d(cal) if cal is not None else "",
            purchase_date="2023-01-12", notes="Keep in protective case. Calibrate annually." if kind == "Tool" else "",
        ).model_dump())

    # ---------- forms & certificates ----------
    gas_checks = ["Installation checked and tested", "Gas tightness test passed", "Appliances operating correctly",
                  "Ventilation satisfactory", "Work complies with AS/NZS 5601", "Customer advised on safe operation"]
    forms = [
        ("Gas Safety Certificate", "Certificate", "J-2015", "Michael", -1, "Completed", 364, "GSC-1016"),
        ("Commissioning Checklist", "Form", "J-2016", "Emma", -3, "Completed", None, "FRM-1015"),
        ("Service Report", "Form", "J-2009", "David", -5, "Completed", None, "FRM-1014"),
        ("Installation Certificate", "Certificate", "J-2008", "Sarah", -10, "Completed", 355, "GSC-1015"),
        ("Backflow Test Certificate", "Certificate", "J-2007", "Chris", -15, "Completed", 20, "GSC-1014"),
        ("Maintenance Checklist", "Form", "J-2017", "Emma", 0, "In Progress", None, "FRM-1013"),
        ("Compliance Certificate", "Certificate", "J-2005", "Michael", -23, "Completed", 342, "GSC-1013"),
        ("Site Risk Assessment", "Form", "J-2004", "David", -25, "Completed", None, "FRM-1012"),
        ("Pressure Test Certificate", "Certificate", "J-1999", "Sarah", -400, "Expired", -35, "GSC-1012"),
        ("Work Handover Form", "Form", "J-1998", "Chris", -31, "Completed", None, "FRM-1011"),
    ]
    for name, kind, jn, tech, day, status, exp, number in forms:
        j = J[jn]
        cust = next(c for c in C.values() if c.id == j.customer_id)
        await db.forms.insert_one(Form(
            name=name, kind=kind, number=number, job_id=j.id, job_number=jn, customer_id=cust.id,
            customer_name=cust.name, customer_address=f"{cust.address}, {cust.city}", technician_id=U[tech].id,
            technician_name=U[tech].name, date=d(day), status=status, expires=d(exp) if exp is not None else "",
            site="Main Plant" if cust.type == "Commercial" else "Residence", appliance_type="Gas boiler",
            appliance_make="Rinnai", appliance_model="Infinity 26", appliance_serial="RN26-88412",
            checks=[ChecklistItem(label=c, done=status != "In Progress" or i < 3) for i, c in enumerate(gas_checks)],
            operating_pressure="2.75 kPa", comments="System installed and tested. All checks passed.",
            signed_by=cust.contact_name if status == "Completed" else "",
        ).model_dump())

    # ---------- activity & counters ----------
    for msg, kind, n in [("Invoice INV-3012 sent", "info", -1), ("New lead from Website: Te Awa Lodge", "lead", -0.21),
                         ("Payment of $2,850.00 received for INV-3010", "payment", -0.13),
                         ("Job J-2014 completed", "completed", -0.04), ("New quote Q-1024 created", "info", -0.001)]:
        await db.activity.insert_one(Activity(message=msg, kind=kind, created_at=ts(n)).model_dump())
    for prefix, seq in [("Q", 25), ("SO", 24), ("INV", 2014), ("J", 34), ("GSC", 16), ("FRM", 15)]:
        await db.counters.insert_one({"_id": prefix, "seq": seq})

    print("Seeded GasCraft CRM data for", T)


if __name__ == "__main__":
    asyncio.run(main())
