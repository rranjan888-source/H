import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Mail, MapPin, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { useList, useRemove, useSave } from "@/lib/hooks";
import type { Customer, CustomerIn, Doc, Job } from "@/lib/types";
import { fmtDate, money } from "@/lib/format";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { Empty, Field, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { XeroBadge, XeroSyncButton } from "@/components/XeroPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const CUSTOMER_FIELDS: FieldDef[] = [
  { name: "name", label: "Customer / company name", required: true, wide: true },
  { name: "type", label: "Type", type: "select", options: ["Residential", "Commercial", "Property Management"] },
  { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
  { name: "contact_name", label: "Primary contact" }, { name: "phone", label: "Phone" },
  { name: "email", label: "Email", type: "email" }, { name: "website", label: "Website" },
  { name: "address", label: "Street address" }, { name: "city", label: "City & postcode" },
  { name: "gst_number", label: "GST number" }, { name: "payment_terms", label: "Payment terms" },
  { name: "credit_limit", label: "Credit limit", type: "number" },
  { name: "notes", label: "Notes", type: "textarea" },
];
export const BLANK_CUSTOMER: CustomerIn = { name: "", type: "Residential", contact_name: "", phone: "", email: "", address: "", city: "", status: "Active", gst_number: "", payment_terms: "7 days", credit_limit: 0, website: "", notes: "" };

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const { data: customers = [] } = useList<Customer>("/customers");
  const { data: jobs = [] } = useList<Job>("/jobs");
  const { data: invoices = [] } = useList<Doc>("/invoices");
  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | "new" | null>(params.get("new") ? "new" : null);
  const save = useSave<CustomerIn, Customer>("/customers", "Customer");
  const remove = useRemove("/customers", "Customer");

  const rows = customers.filter((c) => (type === "All" || c.type === type) && `${c.name} ${c.contact_name} ${c.email} ${c.city}`.toLowerCase().includes(q.toLowerCase()));
  const sel = customers.find((c) => c.id === (selected ?? rows[0]?.id)) ?? null;
  const jobsOf = (id: string) => jobs.filter((j) => j.customer_id === id);
  const invOf = (id: string) => invoices.filter((i) => i.customer_id === id && i.status !== "Draft");
  const selJobs = sel ? jobsOf(sel.id) : [];
  const selInv = sel ? invOf(sel.id) : [];
  const revenue = selInv.reduce((a, i) => a + i.subtotal, 0);
  const outstanding = selInv.filter((i) => i.status !== "Paid").reduce((a, i) => a + i.total - i.amount_paid, 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Customers" subtitle="Manage your customers, contacts, sites and service history."
        actions={<Button onClick={() => setEditing("new")} data-testid="new-customer-button"><Plus className="size-4" />New customer</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total customers" value={customers.length} testid="customers-kpi-total" />
        <KpiCard label="Residential" value={customers.filter((c) => c.type === "Residential").length} tone="blue" testid="customers-kpi-residential" />
        <KpiCard label="Commercial" value={customers.filter((c) => c.type === "Commercial").length} tone="orange" testid="customers-kpi-commercial" />
        <KpiCard label="Active" value={customers.filter((c) => c.status === "Active").length} tone="green" testid="customers-kpi-active" />
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" /><Input className="pl-8" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="customer-search-input" /></div>
            <div className="flex gap-1.5">
              {["All", "Residential", "Commercial"].map((t) => (
                <button key={t} onClick={() => setType(t)} data-testid={`customer-filter-${t.toLowerCase()}`} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors", type === t ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{t}</button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? <Empty text="No customers found" testid="customers-empty" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Jobs</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} onClick={() => setSelected(c.id)} data-testid={`customer-row-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className={cn("cursor-pointer transition-colors hover:bg-orange-50/50", sel?.id === c.id && "bg-orange-50")}>
                    <TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.type}</TableCell>
                    <TableCell><p>{c.contact_name}</p><p className="text-xs text-slate-500">{c.phone}</p></TableCell>
                    <TableCell>{c.city.split(" ")[0]}</TableCell><TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{jobsOf(c.id).length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        {sel && (
          <div className="space-y-6 xl:col-span-5" data-testid="customer-detail-panel">
            <Panel title={<span data-testid="customer-detail-name">{sel.name}</span>} actions={<div className="flex gap-1">
              <Button size="icon-sm" variant="outline" aria-label="Edit customer" onClick={() => setEditing(sel)} data-testid="edit-customer-button"><Pencil className="size-4" /></Button>
              <Button size="icon-sm" variant="outline" aria-label="Delete customer" onClick={() => { if (confirm(`Delete ${sel.name}?`)) remove.mutate(sel.id, { onSuccess: () => setSelected(null) }); }} data-testid="delete-customer-button"><Trash2 className="size-4 text-red-700" /></Button>
            </div>}>
              <div className="mb-4 flex flex-wrap items-center gap-2"><StatusBadge status={sel.type} /><StatusBadge status={sel.status} /><XeroBadge id={sel.xero_contact_id} />
                <span className="ml-auto"><XeroSyncButton path={`/xero/customers/${sel.id}/sync`} label="Customer" synced={!!sel.xero_contact_id} testid="xero-sync-customer-button" /></span></div>
              <div className="space-y-2 text-sm text-slate-700">
                <p className="flex items-center gap-2"><MapPin className="size-4 text-orange-600" />{sel.address}, {sel.city}</p>
                <p className="flex items-center gap-2"><Phone className="size-4 text-orange-600" />{sel.phone || "—"} · {sel.contact_name}</p>
                <p className="flex items-center gap-2"><Mail className="size-4 text-orange-600" />{sel.email || "—"}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <Field label="GST number">{sel.gst_number}</Field><Field label="Payment terms">{sel.payment_terms}</Field>
                <Field label="Credit limit">{money(sel.credit_limit)}</Field><Field label="Outstanding"><span className={outstanding ? "font-semibold text-red-700" : ""}>{money(outstanding)}</span></Field>
                <Field label="Customer since">{fmtDate(sel.created_at)}</Field><Field label="Revenue (ex GST)">{money(revenue)}</Field>
              </div>
              {sel.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{sel.notes}</p>}
              <div className="mt-4 flex gap-2">
                <Link to="/quotes/new" className="text-xs font-semibold text-orange-600 hover:underline" data-testid="customer-new-quote-link">+ New quote</Link>
              </div>
            </Panel>
            <Panel title={`Jobs (${selJobs.length})`}>
              {selJobs.length === 0 ? <Empty text="No jobs yet" /> : (
                <ul className="divide-y divide-slate-100">
                  {selJobs.slice(0, 8).map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0"><p className="truncate font-medium">{j.job_type}</p><p className="font-mono text-[11px] text-slate-500">{j.number} · {fmtDate(j.date)}</p></div>
                      <StatusBadge status={j.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Customer value">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="font-heading text-xl font-bold">{selJobs.length}</p><p className="text-xs text-slate-500">Total jobs</p></div>
                <div><p className="font-heading text-xl font-bold">{money(revenue)}</p><p className="text-xs text-slate-500">Revenue ex GST</p></div>
                <div><p className="font-heading text-xl font-bold">{money(selInv.length ? revenue / selInv.length : 0)}</p><p className="text-xs text-slate-500">Avg invoice</p></div>
              </div>
            </Panel>
          </div>
        )}
      </div>
      <EntityDialog<CustomerIn> open={editing !== null} onOpenChange={(o) => { if (!o) { setEditing(null); setParams({}); } }}
        title={editing === "new" ? "New customer" : "Edit customer"} fields={CUSTOMER_FIELDS}
        initial={editing && editing !== "new" ? { ...editing } : BLANK_CUSTOMER} prefix="customer-form" pending={save.isPending}
        onSubmit={async (v) => { const r = await save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, body: v }); setSelected(r.id); }} />
    </div>
  );
}
