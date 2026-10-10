import { Flame } from "lucide-react";
import type { Company, Doc } from "@/lib/types";
import { fmtDate, lineAmount, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const COMPANY: Company = {
  name: "GasCraft Ltd",
  address: "45 Te Rapa Road, Hamilton 3200, New Zealand",
  phone: "07 834 2200",
  email: "office@gascraft.co.nz",
  gst_number: "112-334-556",
};

const TITLES = { quote: "QUOTE", sales_order: "SALES ORDER", invoice: "TAX INVOICE" } as const;
const DUE = { quote: "Expiry", sales_order: "Required", invoice: "Due" } as const;

type PreviewDoc = Pick<Doc, "kind" | "number" | "date" | "due_date" | "reference" | "items" | "terms" | "customer_name" | "site_address" | "message"> &
  Partial<Pick<Doc, "accepted_by" | "accepted_at" | "amount_paid" | "quote_number">>;

export function DocumentPreview({ doc, company = COMPANY, className }: { doc: PreviewDoc; company?: Company; className?: string }) {
  const lines = doc.items.map((i) => lineAmount(i.qty, i.unit_price, i.discount));
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const gst = doc.items.reduce((a, i, k) => a + (lines[k] * i.gst) / 100, 0);
  const total = subtotal + gst;
  return (
    <div data-testid="document-preview" className={cn("print-area rounded-lg border border-slate-300 bg-white p-6 text-[12.5px] text-slate-700 shadow-sm sm:p-8", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-orange-600 text-white"><Flame className="size-5" /></span>
          <div>
            <p className="font-heading text-lg font-extrabold tracking-wide text-slate-900">GASCRAFT</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Gas · Heating · Hot water</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-xl font-bold text-slate-900">{TITLES[doc.kind]}</p>
          <p className="font-mono text-xs font-semibold">{doc.number || "Draft"}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bill to</p>
          <p className="font-semibold text-slate-900">{doc.customer_name || "—"}</p>
          <p className="whitespace-pre-line">{doc.site_address}</p>
        </div>
        <div className="space-y-0.5 text-right">
          <p><span className="text-slate-400">Date:</span> {fmtDate(doc.date)}</p>
          <p><span className="text-slate-400">{DUE[doc.kind]}:</span> {fmtDate(doc.due_date)}</p>
          {doc.reference && <p><span className="text-slate-400">Ref:</span> {doc.reference}</p>}
          {doc.quote_number && doc.kind !== "quote" && <p><span className="text-slate-400">Quote:</span> {doc.quote_number}</p>}
        </div>
      </div>
      {doc.message && <p className="mt-5 whitespace-pre-line rounded-md bg-slate-50 p-3 text-slate-600">{doc.message}</p>}
      <table className="mt-5 w-full">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left text-[10.5px] uppercase tracking-wider text-slate-500">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((i, k) => (
            <tr key={k} className="border-b border-slate-100 align-top">
              <td className="py-2">
                <p className="font-medium text-slate-900">{i.description}</p>
                {i.detail && <p className="text-[11px] text-slate-500">{i.detail}</p>}
              </td>
              <td className="py-2 text-right tabular-nums">{i.qty}</td>
              <td className="py-2 text-right tabular-nums">{money(i.unit_price)}</td>
              <td className="py-2 text-right tabular-nums">{money(lines[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-4 w-56 space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
        <div className="flex justify-between"><span>GST (15%)</span><span className="tabular-nums">{money(gst)}</span></div>
        <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 font-heading text-[15px] font-bold text-slate-900">
          <span>Total (NZD)</span><span data-testid="preview-total" className="tabular-nums">{money(total)}</span>
        </div>
        {doc.kind === "invoice" && !!doc.amount_paid && (
          <div className="flex justify-between text-green-700"><span>Paid</span><span className="tabular-nums">{money(doc.amount_paid)}</span></div>
        )}
      </div>
      {doc.terms && (
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Terms & conditions</p>
          <p className="mt-1 whitespace-pre-line text-[11px] text-slate-500">{doc.terms}</p>
        </div>
      )}
      {doc.accepted_by && (
        <div className="mt-5 rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
          Accepted by <span className="font-semibold">{doc.accepted_by}</span> on {fmtDate(doc.accepted_at)}
        </div>
      )}
      <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500">
        <p className="font-medium text-slate-700">Thank you for your business.</p>
        <p>{company.name} · {company.address} · {company.phone} · {company.email} · GST {company.gst_number}</p>
      </div>
    </div>
  );
}
