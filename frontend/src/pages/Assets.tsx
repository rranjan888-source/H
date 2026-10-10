import { useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useList, useLookups, useRemove, useSave, useToday } from "@/lib/hooks";
import type { Asset, AssetIn } from "@/lib/types";
import { daysUntil, fmtDate } from "@/lib/format";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { Empty, Field, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const STATUSES = ["Available", "In Use", "On Road", "In Service", "Off Road", "Calibration Due"];
type Due = { asset: Asset; label: string; date: string; days: number };

function DueCell({ date, today }: { date: string; today: string }) {
  const n = daysUntil(date, today);
  if (n === null) return <span className="text-slate-300">—</span>;
  return (
    <span className={cn("tabular-nums", n < 0 ? "font-semibold text-red-700" : n <= 30 ? "font-semibold text-yellow-700" : "")}>
      {fmtDate(date)}{n < 0 ? " · overdue" : n <= 30 ? ` · ${n}d` : ""}
    </span>
  );
}

export default function Assets() {
  const today = useToday();
  const { data: assets = [] } = useList<Asset>("/assets");
  const { userOpts } = useLookups();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Asset | "new" | null>(null);
  const save = useSave<AssetIn, Asset>("/assets", "Asset");
  const remove = useRemove("/assets", "Asset");
  const sel = assets.find((a) => a.id === selected) ?? null;

  const dues: Due[] = today ? assets.flatMap((a) =>
    ([["Service", a.next_service], ["WOF", a.wof_expiry], ["Rego", a.rego_expiry], ["Calibration", a.calibration_due]] as const)
      .filter(([, d]) => d)
      .map(([label, d]) => ({ asset: a, label, date: d, days: daysUntil(d, today) ?? 0 })),
  ) : [];
  const dueSoon = dues.filter((d) => d.days >= 0 && d.days <= 30);
  const overdue = dues.filter((d) => d.days < 0);
  const vehicles = assets.filter((a) => a.kind === "Vehicle");
  const tools = assets.filter((a) => a.kind !== "Vehicle");

  const list = (tab === "vehicles" || tab === "wof" ? vehicles : tab === "tools" ? tools : tab === "calibration" ? assets.filter((a) => a.calibration_due) : assets)
    .filter((a) => `${a.name} ${a.asset_code} ${a.assigned_name} ${a.location}`.toLowerCase().includes(q.toLowerCase()));

  const fields: FieldDef[] = [
    { name: "name", label: "Asset name", required: true, wide: true },
    { name: "kind", label: "Type", type: "select", options: ["Vehicle", "Tool", "Equipment"] },
    { name: "status", label: "Status", type: "select", options: STATUSES },
    { name: "asset_code", label: "Asset ID / Rego" }, { name: "serial", label: "Serial number" },
    { name: "category", label: "Category" }, { name: "brand", label: "Brand" }, { name: "model", label: "Model" },
    { name: "assigned_to", label: "Assigned to", type: "select", options: userOpts },
    { name: "location", label: "Location" }, { name: "condition", label: "Condition", type: "select", options: ["New", "Good", "Fair", "Poor"] },
    { name: "next_service", label: "Next service", type: "date" }, { name: "calibration_due", label: "Calibration due", type: "date" },
    { name: "wof_expiry", label: "WOF expiry", type: "date" }, { name: "rego_expiry", label: "Rego expiry", type: "date" },
    { name: "purchase_date", label: "Purchase date", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];
  const blank: AssetIn = { name: "", kind: "Tool", asset_code: "", serial: "", category: "", brand: "", model: "", assigned_to: "", location: "", status: "Available", next_service: "", wof_expiry: "", rego_expiry: "", calibration_due: "", purchase_date: "", condition: "Good", notes: "" };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Asset Management" subtitle="Vehicles, tools and equipment — servicing, WOF, rego and calibration in one place."
        actions={<Button onClick={() => setEditing("new")} data-testid="new-asset-button"><Plus className="size-4" />Add asset</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total assets" value={assets.length} testid="assets-kpi-total" />
        <KpiCard label="Vehicles" value={vehicles.length} hint={`${vehicles.filter((v) => v.status === "On Road").length} on road`} tone="blue" testid="assets-kpi-vehicles" />
        <KpiCard label="Tools & equipment" value={tools.length} hint={`${tools.filter((v) => v.status === "Available").length} available`} tone="green" testid="assets-kpi-tools" />
        <KpiCard label="Due in 30 days" value={dueSoon.length} tone="yellow" testid="assets-kpi-due" />
        <KpiCard label="Overdue" value={overdue.length} tone="red" testid="assets-kpi-overdue" />
        <KpiCard label="Calibration due" value={dues.filter((d) => d.label === "Calibration" && d.days <= 30).length} tone="orange" testid="assets-kpi-calibration" />
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
        <TabsList className="mb-4 flex-wrap">
          {[["all", "All assets"], ["vehicles", "Vehicles"], ["tools", "Tools & Equipment"], ["maintenance", "Maintenance"], ["wof", "WOF & Rego"], ["calibration", "Calibration"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} data-testid={`assets-tab-${v}`}>{l}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Panel>
        {tab === "maintenance" ? (
          [...overdue, ...dueSoon].length === 0 ? <Empty text="Nothing due in the next 30 days" /> : (
            <Table data-testid="maintenance-table">
              <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Check</TableHead><TableHead>Due</TableHead><TableHead>Assigned</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...overdue, ...dueSoon].sort((a, b) => a.days - b.days).map((d) => (
                  <TableRow key={`${d.asset.id}-${d.label}`} className="cursor-pointer" onClick={() => setSelected(d.asset.id)}>
                    <TableCell className="font-medium">{d.asset.name}</TableCell><TableCell>{d.label}</TableCell>
                    <TableCell><DueCell date={d.date} today={today} /></TableCell><TableCell>{d.asset.assigned_name || "—"}</TableCell>
                    <TableCell><StatusBadge status={d.days < 0 ? "Overdue" : "Pending"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : (
          <>
            <div className="relative mb-4 max-w-xs"><Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" /><Input className="pl-8" placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="asset-search-input" /></div>
            <Table>
              <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead>ID / Serial</TableHead><TableHead>Assigned to</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead>
                {tab === "wof" ? <><TableHead>WOF</TableHead><TableHead>Rego</TableHead></> : <TableHead>{tab === "calibration" ? "Calibration" : "Next service / check"}</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {list.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-orange-50/50" onClick={() => setSelected(a.id)} data-testid={`asset-row-${a.asset_code || a.id}`}>
                    <TableCell className="font-medium">{a.name}</TableCell><TableCell>{a.kind}</TableCell>
                    <TableCell className="font-mono text-xs">{a.asset_code}</TableCell><TableCell>{a.assigned_name || "—"}</TableCell>
                    <TableCell>{a.location}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell>
                    {tab === "wof" ? <><TableCell><DueCell date={a.wof_expiry} today={today} /></TableCell><TableCell><DueCell date={a.rego_expiry} today={today} /></TableCell></>
                      : <TableCell><DueCell date={tab === "calibration" ? a.calibration_due : a.calibration_due || a.next_service} today={today} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Panel>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="asset-detail-sheet">
          {sel && (
            <>
              <SheetHeader>
                <p className="font-mono text-xs text-slate-500">{sel.asset_code}</p>
                <SheetTitle className="text-xl">{sel.name}</SheetTitle>
                <StatusBadge status={sel.status} className="w-fit" />
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Category">{sel.category}</Field><Field label="Type">{sel.kind}</Field>
                  <Field label="Brand">{sel.brand}</Field><Field label="Model">{sel.model}</Field>
                  <Field label="Serial">{sel.serial}</Field><Field label="Condition">{sel.condition}</Field>
                  <Field label="Location">{sel.location}</Field><Field label="Assigned to">{sel.assigned_name || "Not assigned"}</Field>
                  <Field label="Purchased">{fmtDate(sel.purchase_date)}</Field>
                </div>
                <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                  {([["Next service", sel.next_service], ["WOF expiry", sel.wof_expiry], ["Rego expiry", sel.rego_expiry], ["Calibration due", sel.calibration_due]] as const).filter(([, d]) => d).map(([l, d]) => (
                    <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><DueCell date={d} today={today} /></div>
                  ))}
                </div>
                {sel.notes && <p className="text-sm text-slate-600">{sel.notes}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setEditing(sel); setSelected(null); }} data-testid="asset-edit-button"><Pencil className="size-4" />Edit / assign</Button>
                  <Button size="sm" variant="outline" className="text-red-700" onClick={() => { if (confirm("Delete asset?")) remove.mutate(sel.id, { onSuccess: () => setSelected(null) }); }} data-testid="asset-delete-button"><Trash2 className="size-4" />Delete</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EntityDialog<AssetIn> open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add asset" : "Edit asset"}
        fields={fields} initial={editing && editing !== "new" ? { ...editing } : blank} prefix="asset-form" pending={save.isPending}
        onSubmit={(v) => save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, body: v })} />
    </div>
  );
}
