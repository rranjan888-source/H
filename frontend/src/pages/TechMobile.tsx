import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, MapPin, Navigation, Phone, Play, ShieldCheck, Truck, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useList, useMe, useSave, useToday } from "@/lib/hooks";
import type { Asset, FormDoc, Job, JobIn, Timesheet } from "@/lib/types";
import { fmtDate, fmtTime } from "@/lib/format";
import { toJobIn } from "@/pages/Schedule";
import { ClockWidget } from "@/pages/People";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Tab = "jobs" | "time" | "assets";

export default function TechMobile() {
  const me = useMe().data;
  const today = useToday();
  const { data: jobs = [] } = useList<Job>("/jobs");
  const { data: assets = [] } = useList<Asset>("/assets");
  const { data: forms = [] } = useList<FormDoc>("/forms");
  const { data: entries = [] } = useList<Timesheet>("/timesheets");
  const [tab, setTab] = useState<Tab>("jobs");
  const [openJob, setOpenJob] = useState<string | null>(null);
  const save = useSave<JobIn, Job>("/jobs", "Job");

  // Admins previewing the app see every technician's jobs; technicians see their own.
  const mine = jobs.filter((j) => j.date === today && j.status !== "Unscheduled" && (me?.role === "admin" || j.assigned_to === me?.id))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const next = mine.find((j) => j.status !== "Completed");
  const job = jobs.find((j) => j.id === openJob) ?? null;
  const myAssets = assets.filter((a) => a.assigned_to === me?.id);
  const todayEntries = entries.filter((e) => e.user_id === me?.id && e.date === today);
  const update = (j: Job, patch: Partial<JobIn>) => save.mutate({ id: j.id, body: { ...toJobIn(j), ...patch } });

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-[2rem] border-8 border-navy bg-slate-50 shadow-2xl" data-testid="tech-app">
        <div className="bg-navy px-5 pb-6 pt-5 text-white">
          {job ? (
            <button onClick={() => setOpenJob(null)} className="flex items-center gap-1 text-sm text-slate-300" data-testid="tech-back-button"><ArrowLeft className="size-4" />Back to jobs</button>
          ) : (
            <>
              <p className="text-sm text-slate-400">{today ? fmtDate(today, "EEE, d MMM yyyy") : ""}</p>
              <h1 className="mt-1 text-2xl font-bold" data-testid="tech-greeting">Hello, {me?.name.split(" ")[0] ?? ""}</h1>
              <p className="text-sm text-slate-300">Here's your day at a glance.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Today", mine.length], ["In progress", mine.filter((j) => j.status === "In Progress").length], ["Done", mine.filter((j) => j.status === "Completed").length]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-white/10 py-2"><p className="font-heading text-xl font-bold">{v}</p><p className="text-[11px] text-slate-300">{l}</p></div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="min-h-[480px] space-y-4 p-4">
          {job ? (
            <div className="space-y-4" data-testid="tech-job-detail">
              <div className="rounded-2xl bg-white p-4 shadow-xs">
                <p className="font-mono text-xs text-slate-500">{job.number}</p>
                <h2 className="text-xl font-bold">{job.job_type}</h2>
                <div className="mt-1"><StatusBadge status={job.status} testid="tech-job-status" /></div>
                <p className="mt-3 font-semibold">{job.customer_name}</p>
                <p className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 size-4 text-orange-600" />{job.address}</p>
                <p className="mt-1 text-sm text-slate-600">{fmtDate(job.date, "EEE d MMM")} · {fmtTime(job.start_time)} ({job.duration_hours}h)</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {job.customer_phone && <a href={`tel:${job.customer_phone}`} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium" data-testid="tech-call-button"><Phone className="size-4" />Call</a>}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium" data-testid="tech-map-button"><Navigation className="size-4" />Open in Maps</a>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{job.description}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-xs">
                <p className="mb-2 font-semibold">Checklist</p>
                {job.checklist.map((c, i) => (
                  <label key={i} className="flex items-center gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0">
                    <Checkbox checked={c.done} onCheckedChange={(v) => update(job, { checklist: job.checklist.map((x, k) => (k === i ? { ...x, done: !!v } : x)) })} data-testid={`tech-checklist-${i}`} />
                    <span className={c.done ? "text-slate-400 line-through" : ""}>{c.label}</span>
                  </label>
                ))}
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-xs">
                <p className="mb-2 font-semibold">Forms & certificates</p>
                {forms.filter((f) => f.job_id === job.id).map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-1.5 text-sm"><span>{f.name}</span><StatusBadge status={f.status} /></div>
                ))}
                <Link to={`/forms?new=1&job=${job.id}`} className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-dashed border-orange-300 py-2 text-sm font-semibold text-orange-700" data-testid="tech-open-form-link"><ShieldCheck className="size-4" />Open form</Link>
              </div>
              {job.status !== "Completed" && (
                job.status === "In Progress" ? (
                  <Button size="lg" className="w-full bg-green-700 hover:bg-green-800" onClick={() => update(job, { status: "Completed", checklist: job.checklist.map((c) => ({ ...c, done: true })) })} data-testid="tech-complete-job-button"><CheckCircle2 className="size-5" />Complete job</Button>
                ) : (
                  <Button size="lg" className="w-full" onClick={() => update(job, { status: "In Progress" })} data-testid="tech-start-job-button"><Play className="size-5" />Start job</Button>
                )
              )}
            </div>
          ) : tab === "jobs" ? (
            <>
              {next && (
                <div className="rounded-2xl bg-white p-4 shadow-xs" data-testid="tech-next-job">
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Next job</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{fmtTime(next.start_time)} · {next.number}</p>
                  <p className="text-lg font-bold">{next.job_type}</p>
                  <p className="text-sm text-slate-600">{next.customer_name}</p>
                  <Button className="mt-3 w-full" onClick={() => setOpenJob(next.id)} data-testid="tech-next-job-open">{next.status === "In Progress" ? "Continue job" : "View & start job"}</Button>
                </div>
              )}
              <p className="px-1 text-sm font-semibold text-slate-700">Today's schedule</p>
              {mine.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">No jobs today</p>}
              {mine.map((j) => (
                <button key={j.id} onClick={() => setOpenJob(j.id)} data-testid={`tech-job-${j.number}`} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-xs transition-transform duration-150 active:scale-[0.99]">
                  <span className="w-16 shrink-0 font-mono text-xs font-semibold text-slate-500">{fmtTime(j.start_time)}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{j.customer_name}</p><p className="truncate text-xs text-slate-500">{j.job_type}{me?.role === "admin" ? ` · ${j.assigned_name}` : ""}</p></div>
                  <StatusBadge status={j.status} />
                </button>
              ))}
            </>
          ) : tab === "time" ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-4 text-center shadow-xs"><p className="mb-3 text-sm text-slate-500">{today ? fmtDate(today, "EEE, d MMM") : ""}</p><ClockWidget /></div>
              <div className="rounded-2xl bg-white p-4 shadow-xs">
                <p className="mb-2 font-semibold">Today's time</p>
                {todayEntries.length === 0 && <p className="text-sm text-slate-500">No time logged yet</p>}
                {todayEntries.map((e) => <div key={e.id} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0"><span>{e.job_number || e.activity}</span><span className="tabular-nums">{e.open ? "Running" : `${e.hours}h`}</span></div>)}
                <div className="mt-2 flex justify-between font-semibold"><span>Total</span><span data-testid="tech-total-hours">{todayEntries.reduce((a, e) => a + e.hours, 0).toFixed(2)}h</span></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {myAssets.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">No assets assigned to you</p>}
              {myAssets.map((a) => (
                <div key={a.id} className="rounded-2xl bg-white p-4 shadow-xs" data-testid={`tech-asset-${a.asset_code}`}>
                  <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold">{a.kind === "Vehicle" ? <Truck className="size-4 text-orange-600" /> : <Wrench className="size-4 text-orange-600" />}{a.name}</p><StatusBadge status={a.status} /></div>
                  <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {a.wof_expiry && <p>WOF expiry: {fmtDate(a.wof_expiry)}</p>}
                    {a.rego_expiry && <p>Rego expiry: {fmtDate(a.rego_expiry)}</p>}
                    {a.next_service && <p>Next service: {fmtDate(a.next_service)}</p>}
                    {a.calibration_due && <p>Calibration due: {fmtDate(a.calibration_due)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!job && (
          <nav className="grid grid-cols-3 border-t border-slate-200 bg-white">
            {([["jobs", "My jobs", CheckCircle2], ["time", "Timesheet", Clock], ["assets", "Van & tools", Truck]] as const).map(([t, l, Icon]) => (
              <button key={t} onClick={() => setTab(t)} data-testid={`tech-tab-${t}`} className={cn("flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors", tab === t ? "text-orange-600" : "text-slate-400")}>
                <Icon className="size-5" />{l}
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
