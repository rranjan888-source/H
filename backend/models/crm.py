"""All CRM Pydantic models. Mirrored by hand in frontend/src/lib/types.ts — keep in sync."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def _id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ChecklistItem(BaseModel):
    label: str
    done: bool = False


# ---------- Users / auth ----------
class UserIn(BaseModel):
    name: str
    email: str
    role: str = "technician"  # admin | technician
    title: str = "Technician"
    phone: str = ""
    status: str = "Active"
    vehicle: str = ""
    password: Optional[str] = None


class User(BaseModel):
    id: str = Field(default_factory=_id)
    name: str
    email: str
    role: str = "technician"
    title: str = "Technician"
    phone: str = ""
    status: str = "Active"
    vehicle: str = ""
    created_at: str = Field(default_factory=now_iso)


class LoginIn(BaseModel):
    email: str
    password: str


# ---------- Customers / leads ----------
class CustomerIn(BaseModel):
    name: str
    type: str = "Residential"
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    status: str = "Active"
    gst_number: str = ""
    payment_terms: str = "7 days"
    credit_limit: float = 0
    website: str = ""
    notes: str = ""


class Customer(CustomerIn):
    id: str = Field(default_factory=_id)
    created_at: str = Field(default_factory=now_iso)


class LeadIn(BaseModel):
    name: str
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    city: str = ""
    source: str = "Website"
    service: str = ""
    value: float = 0
    stage: str = "New"  # New | Contacted | Qualified | Won | Lost
    notes: str = ""


class Lead(LeadIn):
    id: str = Field(default_factory=_id)
    customer_id: str = ""
    created_at: str = Field(default_factory=now_iso)


# ---------- Quotes / Sales orders / Invoices (one collection, `kind`) ----------
class LineItem(BaseModel):
    description: str
    detail: str = ""
    qty: float = 1
    unit_price: float = 0
    discount: float = 0
    gst: float = 15


class DocumentIn(BaseModel):
    customer_id: str
    site_address: str = ""
    date: str
    due_date: str = ""
    reference: str = ""
    assigned_to: str = ""
    message: str = ""
    items: list[LineItem] = []
    terms: str = ""
    internal_notes: str = ""
    tags: list[str] = []
    status: str = "Draft"


class Document(DocumentIn):
    id: str = Field(default_factory=_id)
    kind: str  # quote | sales_order | invoice
    number: str = ""
    customer_name: str = ""
    customer_email: str = ""
    assigned_name: str = ""
    subtotal: float = 0
    gst_total: float = 0
    total: float = 0
    amount_paid: float = 0
    sent_at: Optional[str] = None
    accepted_at: Optional[str] = None
    accepted_by: str = ""
    paid_at: Optional[str] = None
    quote_id: str = ""
    quote_number: str = ""
    sales_order_id: str = ""
    sales_order_number: str = ""
    job_id: str = ""
    job_number: str = ""
    created_at: str = Field(default_factory=now_iso)


class AcceptIn(BaseModel):
    name: str
    signature: str


class PaymentIn(BaseModel):
    amount: float


class Company(BaseModel):
    name: str = "GasCraft Ltd"
    address: str = "45 Te Rapa Road, Hamilton 3200, New Zealand"
    phone: str = "07 834 2200"
    email: str = "office@gascraft.co.nz"
    gst_number: str = "112-334-556"


class PublicQuote(BaseModel):
    quote: Document
    customer: Customer
    company: Company


# ---------- Jobs ----------
class JobIn(BaseModel):
    customer_id: str
    address: str = ""
    job_type: str
    description: str = ""
    priority: str = "Medium"  # Low | Medium | High
    status: str = "Unscheduled"  # Unscheduled | Scheduled | In Progress | Pending | Completed | Cancelled
    date: str = ""
    start_time: str = ""
    duration_hours: float = 2
    assigned_to: str = ""
    checklist: list[ChecklistItem] = []


class Job(JobIn):
    id: str = Field(default_factory=_id)
    number: str = ""
    customer_name: str = ""
    customer_phone: str = ""
    assigned_name: str = ""
    quote_id: str = ""
    quote_number: str = ""
    sales_order_id: str = ""
    invoice_id: str = ""
    invoice_number: str = ""
    value: float = 0
    completed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# ---------- People ----------
class TimesheetIn(BaseModel):
    user_id: str
    date: str
    hours: float
    type: str = "Billable"  # Billable | Non-Billable | Travel | Break
    job_number: str = ""
    activity: str = ""


class Timesheet(TimesheetIn):
    id: str = Field(default_factory=_id)
    user_name: str = ""
    clock_in: Optional[str] = None
    open: bool = False
    created_at: str = Field(default_factory=now_iso)


class ClockIn(BaseModel):
    job_number: str = ""
    activity: str = ""
    type: str = "Billable"


class LeaveIn(BaseModel):
    user_id: str
    type: str = "Annual Leave"
    start_date: str
    end_date: str = ""
    status: str = "Pending"
    notes: str = ""


class Leave(LeaveIn):
    id: str = Field(default_factory=_id)
    user_name: str = ""
    created_at: str = Field(default_factory=now_iso)


# ---------- Assets ----------
class AssetIn(BaseModel):
    name: str
    kind: str = "Tool"  # Vehicle | Tool | Equipment
    asset_code: str = ""
    serial: str = ""
    category: str = ""
    brand: str = ""
    model: str = ""
    assigned_to: str = ""
    location: str = ""
    status: str = "Available"
    next_service: str = ""
    wof_expiry: str = ""
    rego_expiry: str = ""
    calibration_due: str = ""
    purchase_date: str = ""
    condition: str = "Good"
    notes: str = ""


class Asset(AssetIn):
    id: str = Field(default_factory=_id)
    assigned_name: str = ""
    created_at: str = Field(default_factory=now_iso)


# ---------- Forms & certificates ----------
class FormIn(BaseModel):
    name: str = "Gas Safety Certificate"
    kind: str = "Certificate"  # Certificate | Form
    job_id: str = ""
    customer_id: str = ""
    technician_id: str = ""
    date: str
    status: str = "In Progress"  # In Progress | Completed | Expired
    expires: str = ""
    site: str = ""
    appliance_type: str = ""
    appliance_make: str = ""
    appliance_model: str = ""
    appliance_serial: str = ""
    checks: list[ChecklistItem] = []
    pressure_test: str = "Pass"
    leak_test: str = "Pass"
    operating_pressure: str = ""
    appliance_operation: str = "Pass"
    comments: str = ""
    signed_by: str = ""


class Form(FormIn):
    id: str = Field(default_factory=_id)
    number: str = ""
    job_number: str = ""
    customer_name: str = ""
    customer_address: str = ""
    technician_name: str = ""
    created_at: str = Field(default_factory=now_iso)


# ---------- Activity & stats ----------
class Activity(BaseModel):
    id: str = Field(default_factory=_id)
    message: str
    kind: str = "info"
    created_at: str = Field(default_factory=now_iso)


class Kpi(BaseModel):
    label: str
    value: float
    is_money: bool = False


class NameValue(BaseModel):
    name: str
    value: float


class DayMoney(BaseModel):
    day: str
    money_in: float
    invoiced: float


class Dashboard(BaseModel):
    today: str
    kpis: list[Kpi]
    today_jobs: list[Job]
    jobs_by_status: list[NameValue]
    money: list[DayMoney]
    money_in_total: float
    invoiced_total: float
    vehicles: list[NameValue]
    tools: list[NameValue]
    activity: list[Activity]


class Reports(BaseModel):
    kpis: list[Kpi]
    revenue_by_month: list[NameValue]
    jobs_by_type: list[NameValue]
    jobs_by_status: list[NameValue]
    revenue_by_customer_type: list[NameValue]
    top_customers: list[NameValue]
    team_productivity: list[NameValue]
    outstanding: list[Document]
