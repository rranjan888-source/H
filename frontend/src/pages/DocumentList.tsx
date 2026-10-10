import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useList } from "@/lib/hooks";
import type { Doc, DocKind } from "@/lib/types";
import { fmtDate, money, moneyShort } from "@/lib/format";
import { Empty, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const DOC_META: Record<DocKind, { path: string; title: string; single: string; statuses: string[]; dueLabel: string; subtitle: string }> = {
  quote: { path: "/quotes", title: "Quotes", single: "Quote", statuses: ["Draft", "Sent", "Accepted", "Converted", "Declined"], dueLabel: "Expiry", subtitle: "Create, send and track quotes. Customers can accept online." },
  sales_order: { path: "/sales-orders", title: "Sales Orders", single: "Sales Order", statuses: ["Draft", "Confirmed", "In Progress", "Completed", "Invoiced"], dueLabel: "Required", subtitle: "Confirmed work ready to schedule and invoice." },
  invoice: { path: "/invoices", title: "Billing & Invoices", single: "Invoice", statuses: ["Draft", "Sent", "Paid", "Overdue"], dueLabel: "Due", subtitle: "Send invoices and record payments." },
};

export default function DocumentList({ kind }: { kind: DocKind }) {
  const meta = DOC_META[kind];
  const navigate = useNavigate();
  const { data = [], isLoading } = useList<Doc>(meta.path);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const rows = data.filter(
    (d) => (status === "All" || d.status === status) &&
      `${d.number} ${d.customer_name} ${d.reference}`.toLowerCase().includes(q.toLowerCase()),
  );
  const sum = (st: string[]) => data.filter((d) => st.includes(d.status)).reduce((a, d) => a + d.total - d.amount_paid, 0);
  const slug = kind.replace("_", "-");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={meta.title} subtitle={meta.subtitle}
        actions={<Link to={`${meta.path}/new`} className={buttonVariants()} data-testid={`new-${slug}-button`}><Plus className="size-4" /> New {meta.single}</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={`Total ${meta.title.toLowerCase()}`} value={data.length} testid={`${slug}-kpi-total`} />
        {kind === "invoice" ? (
          <>
            <KpiCard label="Outstanding" value={moneyShort(sum(["Sent", "Overdue"]))} tone="red" testid="invoice-kpi-outstanding" />
            <KpiCard label="Overdue" value={data.filter((d) => d.status === "Overdue").length} tone="red" testid="invoice-kpi-overdue" />
            <KpiCard label="Paid" value={moneyShort(data.filter((d) => d.status === "Paid").reduce((a, d) => a + d.amount_paid, 0))} tone="green" testid="invoice-kpi-paid" />
          </>
        ) : (
          meta.statuses.slice(1, 4).map((s) => (
            <KpiCard key={s} label={s} value={data.filter((d) => d.status === s).length} tone="blue" testid={`${slug}-kpi-${s.toLowerCase().replace(/\s+/g, "-")}`} />
          ))
        )}
      </div>
      <Panel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {["All", ...meta.statuses].map((s) => (
              <button key={s} onClick={() => setStatus(s)} data-testid={`${slug}-filter-${s.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150",
                  status === s ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                {s}
              </button>
            ))}
          </div>
          <div className="relative md:w-72">
            <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
            <Input className="pl-8" placeholder="Search number, customer…" value={q} onChange={(e) => setQ(e.target.value)} data-testid={`${slug}-search-input`} />
          </div>
        </div>
        {!isLoading && rows.length === 0 ? <Empty text={`No ${meta.title.toLowerCase()} found`} testid={`${slug}-empty`} /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Reference</TableHead>
                <TableHead>Date</TableHead><TableHead>{meta.dueLabel}</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} className="cursor-pointer transition-colors hover:bg-orange-50/50" onClick={() => navigate(`${meta.path}/${d.id}`)} data-testid={`${slug}-row-${d.number}`}>
                  <TableCell className="font-mono text-xs font-semibold">{d.number}</TableCell>
                  <TableCell className="font-medium">{d.customer_name}</TableCell>
                  <TableCell className="max-w-48 truncate text-slate-500">{d.reference}</TableCell>
                  <TableCell>{fmtDate(d.date)}</TableCell>
                  <TableCell>{fmtDate(d.due_date)}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(d.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
