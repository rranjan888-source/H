# GasCraft CRM — SPEC

Field-service CRM for a NZ gas/heating business (from "CRM - Concept Gas Craft.pdf").
Stack: FastAPI + Mongo (backend/), Vite React TS (frontend/). All API under /api.

## Auth
- Cookie JWT (`gc_session`, httpOnly). `POST /api/auth/login`, `/auth/logout`, `GET /auth/me`.
- Roles: `admin` (full sidebar) and `technician` (Schedule, People, Assets, Customers, Forms, Technician App). Technician login lands on `/tech`.
- Credentials: see memory/test_credentials.md.

## Modules / routes (frontend)
- `/` Dashboard (KPIs, today's schedule, jobs donut, money in/invoiced chart, assets glance, activity, quick actions)
- `/leads` kanban (New→Contacted→Qualified→Won/Lost); convert lead → customer
- `/quotes`, `/quotes/:id|new` — editor + live A4 preview; Send (email via Emergent Resend), Copy customer link, Convert to Sales Order, Create Job, Print
- `/sales-orders(/:id)` — Create Job, Create Invoice
- `/invoices(/:id)` — Send invoice email, Record payment (partial/full → Paid)
- `/schedule` — calendar by technician for a day, job list, unscheduled tab; job sheet with checklist, start/complete, create invoice, certificate
- `/people` — weekly timesheet grid, clock in/out, manual entry, team cards, leave (approve/decline)
- `/assets` — vehicles/tools; maintenance, WOF & Rego, calibration due tracking
- `/customers` — list + detail panel (jobs, revenue, outstanding)
- `/forms` — forms & gas safety certificates; tick checks, mark completed, print
- `/reports` — revenue trend, jobs by type/status, revenue by customer type, top customers, team productivity, outstanding (CSV export)
- `/tech` — technician mobile app (my jobs today, start/complete job, checklist, timesheet clock, van & tools)
- `/settings` — team & users CRUD (admin), job/form settings lists, company details
- `/public/quote/:id` — PUBLIC (no login). Customer reviews quote and accepts with name + typed signature → quote status `Accepted` and a **Job is auto-created with status `Unscheduled`** (appears in Schedule › Unscheduled). Draft quotes return 404.

## Data model (Mongo collections)
users, customers, leads, documents (kind = quote | sales_order | invoice; numbers Q-/SO-/INV-), jobs (J-), timesheets, leave, assets, forms (GSC-/FRM-), activity, counters.
Totals computed server-side: subtotal, gst_total (15%), total.

## Email
- Emergent managed Resend (`backend/lib/email.py`), from name `GasCraft Ltd`.
- Quote/invoice email goes to the customer's stored email. Seeded customers use `*.example.co.nz` addresses which are rejected with 400 ("no deliverable email") — set a real email on a customer to test sending.

## Seed
`cd /app/backend && python seed.py` (wipes & reseeds; dates relative to today in Pacific/Auckland).
- 8 users, 10 customers (ABC Manufacturing Ltd, Smith Residence, ...), 6 leads.
- Quotes: Q-1024 (ABC, Sent — can be accepted at /public/quote/<id>), Q-1025 (Draft), Q-1023 (Sent), Q-1022 (Converted → SO-1024).
- Invoices INV-3008..3014 + historic paid invoices for 12 months.
- Jobs: ~13 scheduled today/tomorrow across technicians, 5 Unscheduled (J-2030..J-2034), 20 completed historic.
- 14 assets, 10 forms/certificates, timesheets for current week, 4 leave entries.

## Xero integration (backend/lib/xero.py, routers/xero.py, frontend components/XeroPanel.tsx)
- Settings › Integrations. Needs XERO_CLIENT_ID / XERO_CLIENT_SECRET in backend/.env (currently EMPTY → panel shows setup steps; all /api/xero/* sync calls return 503).
- Redirect URI: <PUBLIC_APP_URL>/api/xero/callback. Scopes: openid profile email offline_access accounting.contacts accounting.invoices.
- Tokens stored in `xero_connection` (key=primary), auto-refreshed with rotation.
- Sync: CRM customers → Xero Contacts (linked by name if exists), Sent/Overdue invoices → ACCREC AUTHORISED (TaxType OUTPUT2, AccountCode XERO_SALES_ACCOUNT=200); Xero payments pulled back (PAID → CRM Paid); Xero contacts imported as customers.
- Auto: invoice "Send" pushes to Xero when connected (failure never blocks the email). Manual: "Sync now" (Settings), "Sync to Xero" on invoice + customer detail (only visible when connected).
- Fields: Customer.xero_contact_id/xero_synced_at; Document.xero_invoice_id/xero_status/xero_synced_at/xero_error.
