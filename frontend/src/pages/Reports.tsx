import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useItem } from "@/lib/hooks";
import type { Reports as ReportsT } from "@/lib/types";
import { fmtDate, money, moneyShort } from "@/lib/format";
import { Empty, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLORS = ["#EA580C", "#0284C7", "#15803D", "#CA8A04", "#64748B", "#9333EA", "#0F1A2C"];

function Breakdown({ data, testid }: { data: ReportsT["jobs_by_type"]; testid: string }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex items-center gap-5" data-testid={testid}>
      <div className="size-36 shrink-0">
        <ResponsiveContainer>
          <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={66} stroke="none" paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.slice(0, 7).map((d, i) => (
          <li key={d.name} className="flex justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate">{d.name}</span></span>
            <span className="tabular-nums text-slate-600">{d.value > 999 ? moneyShort(d.value) : d.value} <span className="text-xs text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Reports() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const qs = start || end ? `?start=${start}&end=${end}` : "";
  const { data } = useItem<ReportsT>(`/reports${qs}`);

  const exportCsv = () => {
    if (!data) return;
    const rows = [["Invoice", "Customer", "Due", "Outstanding"], ...data.outstanding.map((d) => [d.number, d.customer_name, d.due_date, (d.total - d.amount_paid).toFixed(2)])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "outstanding-invoices.csv";
    a.click();
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeader title="Reports" subtitle="Insights to help you grow and manage your business."
        actions={<div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start-input" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end-input" /></div>
          <Button variant="outline" onClick={() => { setStart(""); setEnd(""); }} data-testid="report-clear-button">All time</Button>
        </div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {(data?.kpis ?? []).map((k, i) => <KpiCard key={k.label} label={k.label} value={k.is_money ? moneyShort(k.value) : k.value} tone={["orange", "green", "blue", "red", "slate"][i]} testid={`report-kpi-${k.label.toLowerCase().replace(/[^a-z]+/g, "-")}`} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel title="Revenue trend · last 12 months (ex GST)" className="xl:col-span-8" testid="revenue-trend-panel">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data?.revenue_by_month ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tickFormatter={(m: string) => fmtDate(`${m}-01`, "MMM")} tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l: string) => fmtDate(`${l}-01`, "MMMM yyyy")} />
                <Line type="monotone" dataKey="value" name="Revenue" stroke="#EA580C" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Team productivity · jobs completed" className="xl:col-span-4" testid="team-productivity-panel">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data?.team_productivity ?? []} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} stroke="#94A3B8" />
                <Tooltip /><Bar dataKey="value" name="Jobs" fill="#0284C7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Jobs by type" className="xl:col-span-4"><Breakdown data={data?.jobs_by_type ?? []} testid="jobs-by-type" /></Panel>
        <Panel title="Job status" className="xl:col-span-4"><Breakdown data={data?.jobs_by_status ?? []} testid="jobs-by-status" /></Panel>
        <Panel title="Revenue by customer type" className="xl:col-span-4"><Breakdown data={data?.revenue_by_customer_type ?? []} testid="revenue-by-type" /></Panel>
        <Panel title="Top customers (revenue ex GST)" className="xl:col-span-5" testid="top-customers-panel">
          <Table><TableBody>
            {(data?.top_customers ?? []).map((c, i) => (
              <TableRow key={c.name}><TableCell className="w-8 text-slate-400">{i + 1}</TableCell><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-right tabular-nums">{money(c.value)}</TableCell></TableRow>
            ))}
          </TableBody></Table>
        </Panel>
        <Panel title="Outstanding invoices" className="xl:col-span-7" testid="outstanding-panel" actions={<Button size="sm" variant="outline" onClick={exportCsv} data-testid="export-csv-button">Export CSV</Button>}>
          {data && data.outstanding.length === 0 ? <Empty text="Nothing outstanding" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.outstanding ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><Link to={`/invoices/${d.id}`} className="font-mono text-xs font-semibold text-orange-600">{d.number}</Link></TableCell>
                    <TableCell>{d.customer_name}</TableCell><TableCell>{fmtDate(d.due_date)}</TableCell><TableCell><StatusBadge status={d.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{money(d.total - d.amount_paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
