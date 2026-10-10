// Hand-written mirrors of backend/models/crm.py — keep in sync.

export interface ChecklistItem { label: string; done: boolean }

export interface User {
  id: string; name: string; email: string; role: "admin" | "technician" | string; title: string;
  phone: string; status: string; vehicle: string; created_at: string;
}
export interface UserIn {
  name: string; email: string; role: string; title: string; phone: string; status: string; vehicle: string;
  password?: string | null;
}

export interface CustomerIn {
  name: string; type: string; contact_name: string; phone: string; email: string; address: string; city: string;
  status: string; gst_number: string; payment_terms: string; credit_limit: number; website: string; notes: string;
}
export interface Customer extends CustomerIn { id: string; created_at: string }

export interface LeadIn {
  name: string; contact_name: string; phone: string; email: string; city: string; source: string; service: string;
  value: number; stage: string; notes: string;
}
export interface Lead extends LeadIn { id: string; customer_id: string; created_at: string }

export interface LineItem {
  description: string; detail: string; qty: number; unit_price: number; discount: number; gst: number;
}
export type DocKind = "quote" | "sales_order" | "invoice";
export interface DocumentIn {
  customer_id: string; site_address: string; date: string; due_date: string; reference: string; assigned_to: string;
  message: string; items: LineItem[]; terms: string; internal_notes: string; tags: string[]; status: string;
}
export interface Doc extends DocumentIn {
  id: string; kind: DocKind; number: string; customer_name: string; customer_email: string; assigned_name: string;
  subtotal: number; gst_total: number; total: number; amount_paid: number; sent_at: string | null;
  accepted_at: string | null; accepted_by: string; paid_at: string | null; quote_id: string; quote_number: string;
  sales_order_id: string; sales_order_number: string; job_id: string; job_number: string; created_at: string;
}
export interface Company { name: string; address: string; phone: string; email: string; gst_number: string }
export interface PublicQuote { quote: Doc; customer: Customer; company: Company }

export interface JobIn {
  customer_id: string; address: string; job_type: string; description: string; priority: string; status: string;
  date: string; start_time: string; duration_hours: number; assigned_to: string; checklist: ChecklistItem[];
}
export interface Job extends JobIn {
  id: string; number: string; customer_name: string; customer_phone: string; assigned_name: string;
  quote_id: string; quote_number: string; sales_order_id: string; invoice_id: string; invoice_number: string;
  value: number; completed_at: string | null; created_at: string;
}

export interface TimesheetIn { user_id: string; date: string; hours: number; type: string; job_number: string; activity: string }
export interface Timesheet extends TimesheetIn {
  id: string; user_name: string; clock_in: string | null; open: boolean; created_at: string;
}
export interface LeaveIn { user_id: string; type: string; start_date: string; end_date: string; status: string; notes: string }
export interface Leave extends LeaveIn { id: string; user_name: string; created_at: string }

export interface AssetIn {
  name: string; kind: string; asset_code: string; serial: string; category: string; brand: string; model: string;
  assigned_to: string; location: string; status: string; next_service: string; wof_expiry: string;
  rego_expiry: string; calibration_due: string; purchase_date: string; condition: string; notes: string;
}
export interface Asset extends AssetIn { id: string; assigned_name: string; created_at: string }

export interface FormIn {
  name: string; kind: string; job_id: string; customer_id: string; technician_id: string; date: string;
  status: string; expires: string; site: string; appliance_type: string; appliance_make: string;
  appliance_model: string; appliance_serial: string; checks: ChecklistItem[]; pressure_test: string;
  leak_test: string; operating_pressure: string; appliance_operation: string; comments: string; signed_by: string;
}
export interface FormDoc extends FormIn {
  id: string; number: string; job_number: string; customer_name: string; customer_address: string;
  technician_name: string; created_at: string;
}

export interface Activity { id: string; message: string; kind: string; created_at: string }
export interface Kpi { label: string; value: number; is_money: boolean }
export interface NameValue { name: string; value: number }
export interface DayMoney { day: string; money_in: number; invoiced: number }
export interface Dashboard {
  today: string; kpis: Kpi[]; today_jobs: Job[]; jobs_by_status: NameValue[]; money: DayMoney[];
  money_in_total: number; invoiced_total: number; vehicles: NameValue[]; tools: NameValue[]; activity: Activity[];
}
export interface Reports {
  kpis: Kpi[]; revenue_by_month: NameValue[]; jobs_by_type: NameValue[]; jobs_by_status: NameValue[];
  revenue_by_customer_type: NameValue[]; top_customers: NameValue[]; team_productivity: NameValue[];
  outstanding: Doc[];
}
