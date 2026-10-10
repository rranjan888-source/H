import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Pencil, Phone, Play, Plus, Receipt, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
import { useAction, useList, useLookups, useSave, useToday } from "@/lib/hooks";
import type { Doc, Job, JobIn } from "@/lib/types";
import { fmtDate, fmtTime, money } from "@/lib/format";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { Empty, Field, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const JOB_STATUSES = ["Unscheduled", "Scheduled", "In Progress", "Pending", "Completed", "Cancelled"];
export const JOB_TYPES = ["Boiler Service", "Heat Pump Installation", "Heat Pump Service", "Hot Water Repair", "Hot Water Cylinder Install", "Gas Safety Check", "Gas Leak Check", "Gas Fire Maintenance", "Maintenance", "Annual Heating Service", "Installation", "Repair"];
const START = 7;
const END = 18;
const BLOCK: Record<string, string> = {
  Scheduled: "bg-sky-50 border-sky-400 text-sky-900",
  "In Progress": "bg-orange-50 border-orange-500 text-orange-900",
  Pending: "bg-yellow-50 border-yellow-500 text-yellow-900",
  Completed: "bg-green-50 border-green-600 text-green-900",
  Cancelled: "bg-slate-50 border-slate-300 text-slate-500",
  Unscheduled: "bg-slate-50 border-slate-300 text-slate-600",
};

export function toJobIn(j: Job): JobIn {
  const { customer_id, address, job_type, description, priority, status, date, start_time, duration_hours, assigned_to, checklist } = j;
  return { customer_id, address, job_type, description, priority, status, date, start_time, duration_hours, assigned_to, checklist };
}

function shift(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function JobSheet({ job, onClose, onEdit }: { job: Job | null; onClose: () => void; onEdit: (j: Job) => void }) {
  const navigate = useNavigate();
  const save = useSave<JobIn, Job>("/jobs", "Job");
  const invoice = useAction(() => apiPost<Doc>(`/jobs/${job?.id}/invoice`), (r) => `Invoice ${r.number} ready`);
  if (!job) return null;
  const done = job.checklist.filter((c) => c.done).length;
  const update = (patch: Partial<JobIn>) => save.mutate({ id: job.id, body: { ...toJobIn(job), ...patch } });
  return (
    <Sheet open={!!job} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="job-detail-sheet">
        <SheetHeader>
          <p className="font-mono text-xs font-semibold text-slate-500">{job.number}</p>
          <SheetTitle className="text-xl">{job.job_type}</SheetTitle>
          <div className="flex gap-2"><StatusBadge status={job.status} testid="job-detail-status" /><StatusBadge status={job.priority} /></div>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer">{job.customer_name}</Field>
            <Field label="Assigned to">{job.assigned_name || "Unassigned"}</Field>
            <Field label="Scheduled">{job.date ? `${fmtDate(job.date, "EEE d MMM")} ${fmtTime(job.start_time)}` : "Not scheduled"}</Field>
            <Field label="Duration">{job.duration_hours}h</Field>
          </div>
          <p className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 size-4 shrink-0 text-orange-600" />{job.address}</p>
          {job.customer_phone && <a href={`tel:${job.customer_phone}`} className="flex items-center gap-2 text-sm text-slate-600" data-testid="job-call-link"><Phone className="size-4 text-orange-600" />{job.customer_phone}</a>}
          <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{job.description || "No description"}</p>
          <div>
            <p className="mb-2 text-sm font-semibold">Job checklist ({done}/{job.checklist.length})</p>
            <div className="space-y-2">
              {job.checklist.map((c, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50">
                  <Checkbox checked={c.done} data-testid={`job-checklist-${i}`}
                    onCheckedChange={(v) => update({ checklist: job.checklist.map((x, k) => (k === i ? { ...x, done: !!v } : x)) })} />
                  <span className={c.done ? "text-slate-400 line-through" : ""}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Scheduled", "Pending", "Unscheduled"].includes(job.status) && (
              <Button size="sm" onClick={() => update({ status: "In Progress" })} data-testid="job-start-button"><Play className="size-4" />Start job</Button>
            )}
            {job.status === "In Progress" && (
              <Button size="sm" className="bg-green-700 hover:bg-green-800" onClick={() => update({ status: "Completed", checklist: job.checklist.map((c) => ({ ...c, done: true })) })} data-testid="job-complete-button"><CheckCircle2 className="size-4" />Complete job</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onEdit(job)} data-testid="job-edit-button"><Pencil className="size-4" />Edit / schedule</Button>
            <Button size="sm" variant="outline" onClick={() => invoice.mutate(undefined, { onSuccess: (r) => navigate(`/invoices/${r.id}`) })} data-testid="job-invoice-button"><Receipt className="size-4" />{job.invoice_number ? job.invoice_number : "Create invoice"}</Button>
            <Link to={`/forms?new=1&job=${job.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50" data-testid="job-certificate-link"><ShieldCheck className="size-4" />Certificate</Link>
          </div>
          {job.quote_number && <p className="text-xs text-slate-500">From quote <Link className="font-mono text-orange-600" to={`/quotes/${job.quote_id}`}>{job.quote_number}</Link> · value {money(job.value)}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function useJobDialog() {
  const { customerOpts, userOpts } = useLookups();
  const fields: FieldDef[] = [
    { name: "customer_id", label: "Customer", type: "select", options: customerOpts, required: true, wide: true },
    { name: "job_type", label: "Job type", type: "select", options: JOB_TYPES, required: true },
    { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"] },
    { name: "assigned_to", label: "Technician", type: "select", options: userOpts },
    { name: "status", label: "Status", type: "select", options: JOB_STATUSES },
    { name: "date", label: "Date", type: "date" },
    { name: "start_time", label: "Start time", type: "time" },
    { name: "duration_hours", label: "Duration (hours)", type: "number" },
    { name: "address", label: "Address (blank = customer address)", wide: true },
    { name: "description", label: "Description", type: "textarea" },
  ];
  return fields;
}

const DEFAULT_CHECKLIST = ["Arrived on site", "Safety check", "Work completed", "Test and commission", "Customer sign-off"].map((label) => ({ label, done: false }));

export default function Schedule() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const { data: jobs = [] } = useList<Job>("/jobs");
  const { users } = useLookups();
  const techs = users.filter((u) => u.role === "technician");
  const [day, setDay] = useState("");
  const date = day || today;
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Job | null | "new">(params.get("new") ? "new" : null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(params.get("tab") ?? "calendar");
  const save = useSave<JobIn, Job>("/jobs", "Job");
  const fields = useJobDialog();
  const selectedJob = jobs.find((j) => j.id === selected) ?? null;
  const unscheduled = jobs.filter((j) => j.status === "Unscheduled");
  const dayJobs = jobs.filter((j) => j.date === date && j.status !== "Unscheduled");

  const initial = useMemo(() => (editing && editing !== "new" ? { ...toJobIn(editing) } : { customer_id: "", job_type: "Boiler Service", priority: "Medium", assigned_to: "", status: "Unscheduled", date: "", start_time: "09:00", duration_hours: 2, address: "", description: "", checklist: DEFAULT_CHECKLIST }), [editing]);
  const counts = (s: string) => jobs.filter((j) => j.status === s).length;
  const listRows = jobs.filter((j) => `${j.number} ${j.customer_name} ${j.job_type} ${j.assigned_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Jobs & Schedule" subtitle="Manage and dispatch your team's jobs."
        actions={<Button onClick={() => setEditing("new")} data-testid="new-job-button"><Plus className="size-4" />New job</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Total jobs" value={jobs.length} testid="jobs-kpi-total" />
        <KpiCard label="Scheduled" value={counts("Scheduled")} tone="blue" testid="jobs-kpi-scheduled" />
        <KpiCard label="In progress" value={counts("In Progress")} tone="orange" testid="jobs-kpi-in-progress" />
        <KpiCard label="Completed" value={counts("Completed")} tone="green" testid="jobs-kpi-completed" />
        <KpiCard label="Unscheduled" value={unscheduled.length} tone="yellow" testid="jobs-kpi-unscheduled" />
      </div>
      <Tabs value={tab} onValueChange={(v) => { setTab(v as string); setParams({}); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-job-list">Job list</TabsTrigger>
          <TabsTrigger value="unscheduled" data-testid="tab-unscheduled">Unscheduled ({unscheduled.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Panel title={<span className="flex items-center gap-2"><CalendarDays className="size-4 text-orange-600" />{date ? fmtDate(date, "EEEE, d MMMM yyyy") : ""}</span>}
            actions={<div className="flex gap-1">
              <Button size="icon-sm" variant="outline" onClick={() => setDay(shift(date, -1))} data-testid="calendar-prev-day" aria-label="Previous day"><ChevronLeft className="size-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setDay("")} data-testid="calendar-today">Today</Button>
              <Button size="icon-sm" variant="outline" onClick={() => setDay(shift(date, 1))} data-testid="calendar-next-day" aria-label="Next day"><ChevronRight className="size-4" /></Button>
            </div>}>
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="ml-44 grid border-b border-slate-200 pb-1 text-[11px] font-mono text-slate-400" style={{ gridTemplateColumns: `repeat(${END - START}, 1fr)` }}>
                  {Array.from({ length: END - START }).map((_, i) => <span key={i}>{fmtTime(`${START + i}:00`)}</span>)}
                </div>
                {techs.map((t) => {
                  const mine = dayJobs.filter((j) => j.assigned_to === t.id);
                  return (
                    <div key={t.id} className="flex border-b border-slate-100" data-testid={`calendar-row-${t.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="w-44 shrink-0 py-3 pr-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
                        <p className="text-[11px] text-slate-500">{t.title}{t.status !== "Active" && <span className="ml-1 text-yellow-700">· {t.status}</span>}</p>
                      </div>
                      <div className="relative h-16 flex-1 bg-[linear-gradient(to_right,#F1F5F9_1px,transparent_1px)]" style={{ backgroundSize: `${100 / (END - START)}% 100%` }}>
                        {mine.map((j) => {
                          const [h, m] = (j.start_time || "09:00").split(":").map(Number);
                          const left = ((h + m / 60 - START) / (END - START)) * 100;
                          const width = (j.duration_hours / (END - START)) * 100;
                          return (
                            <button key={j.id} onClick={() => setSelected(j.id)} data-testid={`calendar-job-${j.number}`}
                              className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-[11px] shadow-xs transition-transform duration-150 hover:-translate-y-0.5 ${BLOCK[j.status]}`}
                              style={{ left: `${Math.max(left, 0)}%`, width: `${Math.max(width, 6)}%` }}>
                              <p className="truncate font-semibold">{j.number} {j.job_type}</p>
                              <p className="truncate opacity-80">{j.customer_name}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {techs.length > 0 && dayJobs.length === 0 && <p className="mt-4 text-sm text-slate-500">No jobs on this day.</p>}
          </Panel>
        </TabsContent>

        <TabsContent value="list">
          <Panel actions={null}>
            <Input className="mb-4 max-w-xs" placeholder="Search jobs…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="job-search-input" />
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Technician</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {listRows.map((j) => (
                  <TableRow key={j.id} className="cursor-pointer hover:bg-orange-50/50" onClick={() => setSelected(j.id)} data-testid={`job-row-${j.number}`}>
                    <TableCell className="font-mono text-xs font-semibold">{j.number}</TableCell>
                    <TableCell className="font-medium">{j.customer_name}</TableCell>
                    <TableCell>{j.job_type}</TableCell>
                    <TableCell>{j.date ? `${fmtDate(j.date)} ${fmtTime(j.start_time)}` : "—"}</TableCell>
                    <TableCell>{j.assigned_name || "—"}</TableCell>
                    <TableCell><StatusBadge status={j.priority} /></TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="unscheduled">
          <Panel title="Unscheduled jobs" testid="unscheduled-panel">
            {unscheduled.length === 0 ? <Empty text="All jobs are scheduled" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Job type</TableHead><TableHead>Address</TableHead><TableHead>Priority</TableHead><TableHead>Source</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {unscheduled.map((j) => (
                    <TableRow key={j.id} data-testid={`unscheduled-row-${j.number}`}>
                      <TableCell className="font-mono text-xs font-semibold">{j.number}</TableCell>
                      <TableCell className="font-medium">{j.customer_name}</TableCell>
                      <TableCell>{j.job_type}</TableCell>
                      <TableCell className="max-w-52 truncate text-slate-500">{j.address}</TableCell>
                      <TableCell><StatusBadge status={j.priority} /></TableCell>
                      <TableCell className="font-mono text-xs">{j.quote_number || "—"}</TableCell>
                      <TableCell><Button size="sm" onClick={() => setEditing(j)} data-testid={`schedule-job-${j.number}`}>Schedule</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <JobSheet job={selectedJob} onClose={() => setSelected(null)} onEdit={(j) => { setSelected(null); setEditing(j); }} />
      <EntityDialog<JobIn>
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "New job" : `Edit / schedule ${editing?.number ?? ""}`}
        fields={fields}
        initial={initial}
        prefix="job-form"
        pending={save.isPending}
        onSubmit={(v) => save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, body: v })}
      />
    </div>
  );
}
