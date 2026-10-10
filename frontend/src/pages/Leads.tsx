import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, Plus, UserCheck } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useAction, useList, useSave } from "@/lib/hooks";
import type { Customer, Lead, LeadIn } from "@/lib/types";
import { ago, moneyShort } from "@/lib/format";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { KpiCard, PageHeader } from "@/components/Page";
import { Button } from "@/components/ui/button";

const STAGES = ["New", "Contacted", "Qualified", "Won", "Lost"];
const STAGE_DOT: Record<string, string> = { New: "bg-sky-500", Contacted: "bg-blue-600", Qualified: "bg-orange-500", Won: "bg-green-600", Lost: "bg-red-500" };

const FIELDS: FieldDef[] = [
  { name: "name", label: "Lead / business name", required: true, wide: true },
  { name: "contact_name", label: "Contact name" }, { name: "phone", label: "Phone" },
  { name: "email", label: "Email", type: "email" }, { name: "city", label: "City" },
  { name: "source", label: "Source", type: "select", options: ["Website", "Referral", "Phone", "Facebook", "Google", "Repeat customer"] },
  { name: "stage", label: "Stage", type: "select", options: STAGES },
  { name: "service", label: "Service required" }, { name: "value", label: "Estimated value", type: "number" },
  { name: "notes", label: "Notes", type: "textarea" },
];
const BLANK: LeadIn = { name: "", contact_name: "", phone: "", email: "", city: "", source: "Website", service: "", value: 0, stage: "New", notes: "" };

export default function Leads() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: leads = [] } = useList<Lead>("/leads");
  const [editing, setEditing] = useState<Lead | "new" | null>(params.get("new") ? "new" : null);
  const save = useSave<LeadIn, Lead>("/leads", "Lead");
  const convert = useAction((id: string) => apiPost<Customer>(`/leads/${id}/convert`), (c) => `${c.name} is now a customer`);
  const open = leads.filter((l) => !["Won", "Lost"].includes(l.stage));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Leads" subtitle="Track enquiries from first contact to won work."
        actions={<Button onClick={() => setEditing("new")} data-testid="new-lead-button"><Plus className="size-4" />New lead</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Open leads" value={open.length} testid="leads-kpi-open" />
        <KpiCard label="New" value={leads.filter((l) => l.stage === "New").length} tone="blue" testid="leads-kpi-new" />
        <KpiCard label="Pipeline value" value={moneyShort(open.reduce((a, l) => a + l.value, 0))} tone="green" testid="leads-kpi-pipeline" />
        <KpiCard label="Won" value={leads.filter((l) => l.stage === "Won").length} tone="green" testid="leads-kpi-won" />
      </div>
      <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-5">
        {STAGES.map((s) => {
          const col = leads.filter((l) => l.stage === s);
          return (
            <div key={s} className="min-w-56 rounded-xl bg-slate-100/80 p-3" data-testid={`lead-column-${s.toLowerCase()}`}>
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-sm font-semibold"><span className={`size-2 rounded-full ${STAGE_DOT[s]}`} />{s}</p>
                <span className="text-xs text-slate-500">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((l) => (
                  <div key={l.id} className="animate-rise rounded-lg border border-slate-200 bg-white p-3 shadow-xs transition-shadow duration-150 hover:shadow-md" data-testid={`lead-card-${l.id}`}>
                    <p className="font-semibold text-slate-900">{l.name}</p>
                    <p className="text-xs text-slate-500">{l.contact_name} · {l.city}</p>
                    <p className="mt-2 text-sm text-slate-700">{l.service}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold tabular-nums">{moneyShort(l.value)}</span>
                      <span className="text-slate-400">{l.source} · {ago(l.created_at)}</span>
                    </div>
                    <div className="mt-3 flex gap-1">
                      <Button size="xs" variant="outline" onClick={() => setEditing(l)} data-testid={`edit-lead-${l.id}`}><Pencil className="size-3" />Edit</Button>
                      {s !== "Won" && s !== "Lost" && (
                        <Button size="xs" variant="outline" onClick={() => { const i = STAGES.indexOf(s); save.mutate({ id: l.id, body: { ...l, stage: STAGES[Math.min(i + 1, 3)] } }); }} data-testid={`advance-lead-${l.id}`}>Next stage</Button>
                      )}
                      {s !== "Lost" && (
                        <Button size="xs" onClick={() => convert.mutate(l.id, { onSuccess: () => navigate("/quotes/new") })} data-testid={`convert-lead-${l.id}`}><UserCheck className="size-3" />{l.customer_id ? "Quote" : "Convert"}</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <EntityDialog<LeadIn> open={editing !== null} onOpenChange={(o) => { if (!o) { setEditing(null); setParams({}); } }} title={editing === "new" ? "New lead" : "Edit lead"}
        fields={FIELDS} initial={editing && editing !== "new" ? { ...editing } : BLANK} prefix="lead-form" pending={save.isPending}
        onSubmit={(v) => save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, body: v })} />
    </div>
  );
}
