import { Link } from "react-router-dom";
import {
  Activity as ActivityIcon, Briefcase, CalendarPlus, ClipboardCheck, Clock, DollarSign, FilePlus, FileText,
  Receipt, Target, Truck, UserPlus, Wrench,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useItem, useMe } from "@/lib/hooks";
import type { Dashboard as DashboardT } from "@/lib/types";
import { ago, fmtDate, fmtTime, money, moneyShort } from "@/lib/format";
import { Empty, KpiCard, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";

const KPI_ICONS = [Briefcase, FileText, Receipt, DollarSign, Target];
const KPI_TONES = ["orange", "blue", "red", "green", "yellow"];
const STATUS_COLORS: Record<string, string> = {
  Completed: "#15803D", "In Progress": "#EA580C", Scheduled: "#0284C7", Pending: "#CA8A04", Unscheduled: "#94A3B8",
};

const QUICK = [
  ["New Quote", "/quotes/new", FilePlus], ["New Job", "/schedule?new=1", CalendarPlus],
  ["New Customer", "/customers?new=1", UserPlus], ["New Invoice", "/invoices/new", Receipt],
  ["Log Timesheet", "/people?new=1", Clock], ["Checklist / Form", "/forms?new=1", ClipboardCheck],
] as const;

export default function Dashboard() {
  const me = useMe();
  const { data } = useItem<DashboardT>("/dashboard");
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const totalJobs = data?.jobs_by_status.reduce((a, b) => a + b.value, 0) ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h1 data-testid="page-title" className="text-3xl font-bold tracking-tight text-slate-900">
            {greet}, {me.data?.name.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening with your business today.</p>
        </div>
        <p className="font-mono text-xs font-semibold text-slate-500" data-testid="dashboard-date">{data ? fmtDate(data.today, "EEE, d MMM yyyy") : ""}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {(data?.kpis ?? []).map((k, i) => (
          <KpiCard key={k.label} testid={`kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`} label={k.label}
            value={k.is_money ? moneyShort(k.value) : k.value} icon={KPI_ICONS[i]} tone={KPI_TONES[i]} />
        ))}
        {!data && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-7" testid="today-schedule-panel" title="Today's Schedule"
          actions={<Link to="/schedule" className="text-xs font-semibold text-orange-600 hover:underline" data-testid="view-schedule-link">View schedule</Link>}>
          {data && data.today_jobs.length === 0 && <Empty text="No jobs scheduled today" />}
          <ul className="divide-y divide-slate-100">
            {data?.today_jobs.map((j) => (
              <li key={j.id} data-testid={`today-job-${j.number}`} className="flex items-center gap-4 py-3">
                <span className="w-20 shrink-0 font-mono text-xs font-semibold text-slate-500">{fmtTime(j.start_time)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{j.job_type}</p>
                  <p className="truncate text-xs text-slate-500">{j.customer_name} · {j.number}</p>
                </div>
                <span className="hidden text-xs text-slate-500 sm:block">{j.assigned_name}</span>
                <StatusBadge status={j.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="xl:col-span-5" title="Jobs Overview" testid="jobs-overview-panel">
          <div className="flex items-center gap-6">
            <div className="relative size-40 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data?.jobs_by_status ?? []} dataKey="value" nameKey="name" innerRadius={52} outerRadius={75} paddingAngle={2} stroke="none">
                    {(data?.jobs_by_status ?? []).map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? "#64748B"} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div><p className="font-heading text-2xl font-extrabold">{totalJobs}</p><p className="text-[11px] text-slate-500">Total jobs</p></div>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {data?.jobs_by_status.map((s) => (
                <li key={s.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[s.name] }} />{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.value} <span className="text-xs font-normal text-slate-400">{totalJobs ? Math.round((s.value / totalJobs) * 100) : 0}%</span></span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="xl:col-span-7" title="Financial Overview · last 14 days" testid="financial-panel">
          <div className="mb-3 flex gap-6 text-sm">
            <div><p className="text-xs text-slate-500">Money in</p><p className="font-heading text-xl font-bold text-green-700">{money(data?.money_in_total ?? 0)}</p></div>
            <div><p className="text-xs text-slate-500">Invoiced</p><p className="font-heading text-xl font-bold text-sky-700">{money(data?.invoiced_total ?? 0)}</p></div>
          </div>
          <div className="h-52">
            <ResponsiveContainer>
              <AreaChart data={data?.money ?? []} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#15803D" stopOpacity={0.25} /><stop offset="100%" stopColor="#15803D" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ginv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0284C7" stopOpacity={0.2} /><stop offset="100%" stopColor="#0284C7" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="day" tickFormatter={(d: string) => fmtDate(d, "d MMM")} tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l: string) => fmtDate(l)} />
                <Area type="monotone" dataKey="money_in" name="Money in" stroke="#15803D" fill="url(#gin)" strokeWidth={2} />
                <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#0284C7" fill="url(#ginv)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="space-y-6 xl:col-span-5">
          <Panel title="Assets at a Glance" testid="assets-glance-panel"
            actions={<Link to="/assets" className="text-xs font-semibold text-orange-600 hover:underline" data-testid="manage-assets-link">Manage</Link>}>
            <div className="grid grid-cols-2 gap-4">
              {[["Vehicles", Truck, data?.vehicles], ["Tools & Equipment", Wrench, data?.tools]].map(([label, Icon, list]) => {
                const I = Icon as typeof Truck;
                const l = (list as DashboardT["vehicles"] | undefined) ?? [];
                return (
                  <div key={label as string} className="rounded-lg bg-slate-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><I className="size-4 text-orange-600" />{label as string}</p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {l.map((s) => <li key={s.name} className="flex justify-between"><span className="text-slate-500">{s.name}</span><span className="font-semibold">{s.value}</span></li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Recent Activity" testid="recent-activity-panel">
            <ul className="space-y-3">
              {data?.activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600"><ActivityIcon className="size-3.5" /></span>
                  <div><p className="text-slate-800">{a.message}</p><p className="text-xs text-slate-400">{ago(a.created_at)}</p></div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Quick Actions" testid="quick-actions-panel">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK.map(([label, to, Icon]) => (
            <Link key={label} to={to} data-testid={`quick-action-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={buttonVariants({ variant: "outline", className: "h-auto flex-col gap-2 py-4 transition-colors hover:border-orange-300 hover:bg-orange-50" })}>
              <Icon className="size-5 text-orange-600" />
              <span className="text-xs font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
