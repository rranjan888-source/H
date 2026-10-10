import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Flame, Plus, Printer, ShieldCheck } from "lucide-react";
import { useList, useLookups, useSave, useToday } from "@/lib/hooks";
import type { FormDoc, FormIn, Job } from "@/lib/types";
import { daysUntil, fmtDate } from "@/lib/format";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { Empty, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const GAS_CHECKS = ["Installation checked and tested", "Gas tightness test passed", "Appliances operating correctly", "Ventilation satisfactory", "Work complies with AS/NZS 5601", "Customer advised on safe operation"];
const FORM_CHECKS = ["Site risk assessed", "Work completed as described", "Area left clean and tidy", "Customer walkthrough completed"];
export const FORM_NAMES = ["Gas Safety Certificate", "Installation Certificate", "Compliance Certificate", "Pressure Test Certificate", "Commissioning Checklist", "Service Report", "Maintenance Checklist", "Site Risk Assessment", "Work Handover Form"];

function toIn(f: FormDoc): FormIn {
  const { name, kind, job_id, customer_id, technician_id, date, status, expires, site, appliance_type, appliance_make, appliance_model, appliance_serial, checks, pressure_test, leak_test, operating_pressure, appliance_operation, comments, signed_by } = f;
  return { name, kind, job_id, customer_id, technician_id, date, status, expires, site, appliance_type, appliance_make, appliance_model, appliance_serial, checks, pressure_test, leak_test, operating_pressure, appliance_operation, comments, signed_by };
}

export function CertificateView({ form, onToggle }: { form: FormDoc; onToggle?: (i: number, v: boolean) => void }) {
  return (
    <div className="print-area rounded-lg border border-slate-300 bg-white p-6 text-sm" data-testid="certificate-view">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-orange-600 text-white"><Flame className="size-5" /></span><p className="font-heading text-lg font-extrabold">GASCRAFT</p></div>
        <div className="text-right"><p className="font-heading font-bold uppercase">{form.name}</p><p className="font-mono text-xs">{form.number}</p></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 text-[13px]">
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer</p><p className="font-semibold">{form.customer_name}</p><p className="text-slate-600">{form.customer_address}</p><p className="text-slate-600">Site: {form.site || "—"}</p></div>
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Job</p><p className="font-mono">{form.job_number || "—"}</p><p>Date: {fmtDate(form.date)}</p><p>Technician: {form.technician_name || "—"}</p>{form.expires && <p>Expires: {fmtDate(form.expires)}</p>}</div>
      </div>
      {form.kind === "Certificate" && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-[12px] sm:grid-cols-4">
          <p><span className="text-slate-400">Appliance</span><br />{form.appliance_type || "—"}</p>
          <p><span className="text-slate-400">Make / model</span><br />{form.appliance_make} {form.appliance_model}</p>
          <p><span className="text-slate-400">Serial</span><br />{form.appliance_serial || "—"}</p>
          <p><span className="text-slate-400">Operating pressure</span><br />{form.operating_pressure || "—"}</p>
        </div>
      )}
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Work completed</p>
      <ul className="mt-2 space-y-1.5">
        {form.checks.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {onToggle ? <Checkbox checked={c.done} onCheckedChange={(v) => onToggle(i, !!v)} data-testid={`certificate-check-${i}`} /> : <CheckCircle2 className={cn("size-4", c.done ? "text-green-600" : "text-slate-300")} />}
            <span className={c.done ? "" : "text-slate-400"}>{c.label}</span>
          </li>
        ))}
      </ul>
      {form.kind === "Certificate" && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[["Pressure test", form.pressure_test], ["Leak test", form.leak_test], ["Appliance operation", form.appliance_operation]].map(([l, v]) => (
            <div key={l} className={cn("rounded-md p-2", v === "Pass" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}><p className="opacity-70">{l}</p><p className="font-bold">{v}</p></div>
          ))}
        </div>
      )}
      {form.comments && <p className="mt-4 text-slate-600"><span className="font-semibold text-slate-800">Comments: </span>{form.comments}</p>}
      <div className="mt-6 grid grid-cols-2 gap-6 border-t border-slate-200 pt-4 text-xs">
        <div><p className="text-slate-400">Technician</p><p className="font-heading text-lg italic">{form.technician_name}</p></div>
        <div><p className="text-slate-400">Customer sign-off</p><p className="font-heading text-lg italic" data-testid="certificate-signed-by">{form.signed_by || "—"}</p></div>
      </div>
    </div>
  );
}

export default function Forms() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const { data: forms = [] } = useList<FormDoc>("/forms");
  const { data: jobs = [] } = useList<Job>("/jobs");
  const { customerOpts, staffOpts } = useLookups();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(!!params.get("new"));
  const save = useSave<FormIn, FormDoc>("/forms", "Form");
  const presetJob = jobs.find((j) => j.id === params.get("job"));

  const expiring = (f: FormDoc) => { const n = daysUntil(f.expires, today); return n !== null && n >= 0 && n <= 30; };
  const rows = forms.filter((f) => tab === "all" || (tab === "certificates" && f.kind === "Certificate") || (tab === "forms" && f.kind === "Form") || (tab === "expiring" && expiring(f)));
  const sel = forms.find((f) => f.id === (selected ?? rows[0]?.id)) ?? null;

  const fields: FieldDef[] = [
    { name: "name", label: "Form / certificate", type: "select", options: FORM_NAMES, wide: true },
    { name: "job_id", label: "Job", type: "select", options: [{ value: "", label: "No job" }, ...jobs.map((j) => ({ value: j.id, label: `${j.number} · ${j.customer_name}` }))] },
    { name: "customer_id", label: "Customer (if no job)", type: "select", options: [{ value: "", label: "From job" }, ...customerOpts] },
    { name: "technician_id", label: "Technician", type: "select", options: staffOpts },
    { name: "date", label: "Date", type: "date" }, { name: "expires", label: "Expires", type: "date" },
    { name: "site", label: "Site" }, { name: "appliance_type", label: "Appliance type" },
    { name: "appliance_make", label: "Make" }, { name: "appliance_model", label: "Model" },
    { name: "appliance_serial", label: "Serial number" }, { name: "operating_pressure", label: "Operating pressure (kPa)" },
    { name: "pressure_test", label: "Pressure test", type: "select", options: ["Pass", "Fail", "N/A"] },
    { name: "leak_test", label: "Leak test", type: "select", options: ["Pass", "Fail", "N/A"] },
    { name: "appliance_operation", label: "Appliance operation", type: "select", options: ["Pass", "Fail", "N/A"] },
    { name: "signed_by", label: "Customer name (sign-off)" },
    { name: "comments", label: "Comments", type: "textarea" },
  ];
  const update = (f: FormDoc, patch: Partial<FormIn>) => save.mutate({ id: f.id, body: { ...toIn(f), ...patch } });

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Forms & Certificates" subtitle="Create, complete and manage service forms and compliance certificates."
        actions={<Button onClick={() => setCreating(true)} data-testid="new-form-button"><Plus className="size-4" />New form</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Total forms" value={forms.length} icon={ShieldCheck} testid="forms-kpi-total" />
        <KpiCard label="Completed" value={forms.filter((f) => f.status === "Completed").length} tone="green" testid="forms-kpi-completed" />
        <KpiCard label="In progress" value={forms.filter((f) => f.status === "In Progress").length} tone="orange" testid="forms-kpi-in-progress" />
        <KpiCard label="Expired" value={forms.filter((f) => f.status === "Expired").length} tone="red" testid="forms-kpi-expired" />
        <KpiCard label="Expiring (30 days)" value={forms.filter(expiring).length} tone="yellow" testid="forms-kpi-expiring" />
      </div>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as string); setSelected(null); }}>
        <TabsList className="mb-4">
          {[["all", "All forms"], ["certificates", "Certificates"], ["forms", "Forms"], ["expiring", "Expiring soon"]].map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`forms-tab-${v}`}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          {rows.length === 0 ? <Empty text="No forms here" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>Form / certificate</TableHead><TableHead>Job</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((f) => (
                  <TableRow key={f.id} onClick={() => setSelected(f.id)} className={cn("cursor-pointer hover:bg-orange-50/50", sel?.id === f.id && "bg-orange-50")} data-testid={`form-row-${f.number}`}>
                    <TableCell><p className="font-medium">{f.name}</p><p className="font-mono text-[11px] text-slate-500">{f.number} · {f.kind}</p></TableCell>
                    <TableCell className="font-mono text-xs">{f.job_number || "—"}</TableCell><TableCell>{f.customer_name}</TableCell>
                    <TableCell>{fmtDate(f.date)}</TableCell><TableCell><StatusBadge status={f.status} /></TableCell><TableCell>{fmtDate(f.expires)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
        {sel && (
          <div className="space-y-3 xl:col-span-5">
            <div className="no-print flex flex-wrap gap-2">
              {sel.status !== "Completed" && <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => update(sel, { status: "Completed", checks: sel.checks.map((c) => ({ ...c, done: true })) })} data-testid="complete-form-button"><CheckCircle2 className="size-4" />Mark completed</Button>}
              <Button size="sm" variant="outline" onClick={() => window.print()} data-testid="print-form-button"><Printer className="size-4" />Print / PDF</Button>
            </div>
            <CertificateView form={sel} onToggle={(i, v) => update(sel, { checks: sel.checks.map((c, k) => (k === i ? { ...c, done: v } : c)) })} />
          </div>
        )}
      </div>
      <EntityDialog<FormIn> open={creating} onOpenChange={(o) => { setCreating(o); if (!o) setParams({}); }} title="New form / certificate" fields={fields} prefix="form-form" pending={save.isPending}
        initial={{ name: "Gas Safety Certificate", kind: "Certificate", job_id: presetJob?.id ?? "", customer_id: "", technician_id: presetJob?.assigned_to ?? "", date: today, status: "In Progress", expires: "", site: "", appliance_type: "", appliance_make: "", appliance_model: "", appliance_serial: "", checks: [], pressure_test: "Pass", leak_test: "Pass", operating_pressure: "", appliance_operation: "Pass", comments: "", signed_by: "" }}
        onSubmit={async (v) => {
          const kind = v.name.includes("Certificate") ? "Certificate" : "Form";
          const r = await save.mutateAsync({ body: { ...v, kind, checks: (kind === "Certificate" ? GAS_CHECKS : FORM_CHECKS).map((label) => ({ label, done: false })) } });
          setSelected(r.id); setTab("all");
        }} />
    </div>
  );
}
