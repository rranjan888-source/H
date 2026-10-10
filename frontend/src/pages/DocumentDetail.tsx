import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Copy, CreditCard, Mail, Plus, Printer, Receipt, Save, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useAction, useItem, useLookups, useRemove, useSave, useToday } from "@/lib/hooks";
import type { Doc, DocKind, DocumentIn, Job, LineItem } from "@/lib/types";
import { fmtDate, lineAmount, money } from "@/lib/format";
import { DOC_META } from "@/pages/DocumentList";
import { DocumentPreview } from "@/components/DocumentPreview";
import { SelectField } from "@/components/EntityDialog";
import { Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TERMS: Record<DocKind, string> = {
  quote: "1. This quote is valid for 14 days from the date of issue.\n2. All work will be carried out in accordance with NZ standards.\n3. Prices are exclusive of any additional works not specified.\n4. Payment is due 7 days from invoice date.\n5. This quote is subject to site inspection if required.",
  sales_order: "1. Work will be carried out in accordance with NZ standards.\n2. Any additional work will be quoted separately.\n3. Payment is due 20th of the following month.",
  invoice: "Payment is due 7 days from invoice date. Bank: 12-3456-7890123-00 (GasCraft Ltd). Please use the invoice number as reference.",
};

const blankItem = (): LineItem => ({ description: "", detail: "", qty: 1, unit_price: 0, discount: 0, gst: 15 });

function addDays(iso: string, n: number) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toInput(d: Doc): DocumentIn {
  const { customer_id, site_address, date, due_date, reference, assigned_to, message, items, terms, internal_notes, tags, status } = d;
  return { customer_id, site_address, date, due_date, reference, assigned_to, message, items, terms, internal_notes, tags, status };
}

export default function DocumentDetail({ kind }: { kind: DocKind }) {
  const meta = DOC_META[kind];
  const { id = "new" } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const today = useToday();
  const { customers, customerOpts, userOpts } = useLookups();
  const { data: doc } = useItem<Doc>(`${meta.path}/${id}`, !isNew);
  const slug = kind.replace("_", "-");

  const [form, setForm] = useState<DocumentIn | null>(null);
  const [loadedFor, setLoadedFor] = useState<string>("");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");

  // Initialise the editable form once per document (or once "today" is known for new docs).
  const key = isNew ? `new-${today}` : doc ? `${doc.id}-${doc.status}` : "";
  if (key && key !== loadedFor && (!isNew || today)) {
    setLoadedFor(key);
    setForm(isNew
      ? { customer_id: "", site_address: "", date: today, due_date: addDays(today, kind === "invoice" ? 7 : 14), reference: "", assigned_to: "", message: "", items: [blankItem()], terms: TERMS[kind], internal_notes: "", tags: [], status: "Draft" }
      : toInput(doc!));
  }

  const save = useSave<DocumentIn, Doc>(meta.path, meta.single);
  const remove = useRemove(meta.path, meta.single);
  const send = useAction(() => apiPost<Doc>(`${meta.path}/${id}/send`), `${meta.single} emailed to customer`);
  const convert = useAction(() => apiPost<Doc>(`/quotes/${id}/convert`), (r) => `Sales order ${r.number} created`);
  const toJob = useAction(() => apiPost<Job>(`${meta.path}/${id}/job`), (r) => `Job ${r.number} ready for scheduling`);
  const toInvoice = useAction(() => apiPost<Doc>(`/sales-orders/${id}/invoice`), (r) => `Invoice ${r.number} created`);
  const pay = useAction((amount: number) => apiPost<Doc>(`/invoices/${id}/payment`, { amount }), "Payment recorded");

  if (!form) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" data-testid="document-loading" />;

  const set = <K extends keyof DocumentIn>(k: K, v: DocumentIn[K]) => setForm({ ...form, [k]: v });
  const setItem = (i: number, patch: Partial<LineItem>) => set("items", form.items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const cust = customers.find((c) => c.id === form.customer_id);
  const subtotal = form.items.reduce((a, i) => a + lineAmount(i.qty, i.unit_price, i.discount), 0);
  const gst = form.items.reduce((a, i) => a + (lineAmount(i.qty, i.unit_price, i.discount) * i.gst) / 100, 0);
  const publicLink = `${window.location.origin}/public/quote/${id}`;

  const onSave = async () => {
    if (!form.customer_id) return toast.error("Please choose a customer");
    if (form.items.some((i) => !i.description.trim())) return toast.error("Every line item needs a description");
    const res = await save.mutateAsync({ id: isNew ? undefined : id, body: form });
    if (isNew) navigate(`${meta.path}/${res.id}`, { replace: true });
  };

  const stepIdx = meta.statuses.indexOf(form.status);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="no-print mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link to={meta.path} className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" data-testid="back-button" aria-label="Back">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="text-xs text-slate-500">{meta.title} › {isNew ? "New" : doc?.number}</p>
            <h1 data-testid="page-title" className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              {isNew ? `New ${meta.single}` : `${meta.single} ${doc?.number}`}
              {!isNew && doc && <StatusBadge status={doc.status} testid="document-status-badge" />}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && doc && kind === "quote" && (
            <>
              <Button variant="outline" size="sm" onClick={() => send.mutate()} disabled={send.isPending} data-testid="send-quote-button"><Mail className="size-4" />{send.isPending ? "Sending…" : doc.sent_at ? "Resend" : "Send to customer"}</Button>
              {doc.status !== "Draft" && <Button variant="outline" size="sm" data-testid="copy-public-link-button" onClick={() => { navigator.clipboard?.writeText(publicLink); toast.success("Customer link copied"); }}><Copy className="size-4" />Copy link</Button>}
              <Button variant="outline" size="sm" onClick={() => convert.mutate(undefined, { onSuccess: (r) => navigate(`/sales-orders/${r.id}`) })} data-testid="convert-to-so-button"><ShoppingCart className="size-4" />{doc.sales_order_id ? "View sales order" : "Convert to SO"}</Button>
            </>
          )}
          {!isNew && doc && kind !== "invoice" && (
            <Button variant="outline" size="sm" onClick={() => toJob.mutate(undefined, { onSuccess: () => navigate("/schedule?tab=unscheduled") })} data-testid="create-job-button"><Briefcase className="size-4" />{doc.job_id ? `Job ${doc.job_number}` : "Create job"}</Button>
          )}
          {!isNew && doc && kind === "sales_order" && (
            <Button variant="outline" size="sm" onClick={() => toInvoice.mutate(undefined, { onSuccess: (r) => navigate(`/invoices/${r.id}`) })} data-testid="create-invoice-button"><Receipt className="size-4" />Create invoice</Button>
          )}
          {!isNew && doc && kind === "invoice" && (
            <>
              <Button variant="outline" size="sm" onClick={() => send.mutate()} disabled={send.isPending} data-testid="send-invoice-button"><Mail className="size-4" />{send.isPending ? "Sending…" : doc.sent_at ? "Resend" : "Send invoice"}</Button>
              {doc.status !== "Paid" && <Button variant="outline" size="sm" onClick={() => { setPayAmount(String((doc.total - doc.amount_paid).toFixed(2))); setPayOpen(true); }} data-testid="record-payment-button"><CreditCard className="size-4" />Record payment</Button>}
            </>
          )}
          {!isNew && <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="print-button"><Printer className="size-4" />Print / PDF</Button>}
          {!isNew && <Button variant="ghost" size="sm" className="text-red-700" data-testid="delete-document-button" onClick={() => { if (confirm(`Delete ${doc?.number}?`)) remove.mutate(id, { onSuccess: () => navigate(meta.path) }); }}><Trash2 className="size-4" /></Button>}
          <Button size="sm" onClick={onSave} disabled={save.isPending} data-testid="save-document-button"><Save className="size-4" />{save.isPending ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="no-print space-y-6 lg:col-span-7">
          <Panel title="Status">
            <div className="flex flex-wrap items-center gap-2">
              {meta.statuses.map((s, i) => (
                <button key={s} type="button" onClick={() => set("status", s)} data-testid={`status-step-${s.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                    i <= stepIdx ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                  <span className={cn("grid size-4 place-items-center rounded-full text-[10px]", i <= stepIdx ? "bg-orange-600 text-white" : "bg-slate-200")}>{i + 1}</span>{s}
                </button>
              ))}
            </div>
            {doc?.sent_at && <p className="mt-3 text-xs text-slate-500" data-testid="sent-info">Sent {fmtDate(doc.sent_at, "d MMM yyyy, h:mm a")} to {doc.customer_email}</p>}
            {doc?.accepted_by && <p className="mt-1 text-xs font-medium text-green-700" data-testid="accepted-info">Accepted online by {doc.accepted_by} on {fmtDate(doc.accepted_at, "d MMM yyyy, h:mm a")}</p>}
            {doc && (doc.quote_number || doc.sales_order_number || doc.job_number) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {doc.quote_number && kind !== "quote" && <Link className="rounded bg-slate-100 px-2 py-1 font-mono" to={`/quotes/${doc.quote_id}`}>{doc.quote_number}</Link>}
                {doc.sales_order_number && <Link className="rounded bg-slate-100 px-2 py-1 font-mono" to={`/sales-orders/${doc.sales_order_id}`}>{doc.sales_order_number}</Link>}
                {doc.job_number && <Link className="rounded bg-slate-100 px-2 py-1 font-mono" to="/schedule">{doc.job_number}</Link>}
              </div>
            )}
          </Panel>

          <Panel title="Customer & details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Customer *</Label>
                <SelectField value={form.customer_id} onChange={(v) => { const c = customers.find((x) => x.id === v); setForm({ ...form, customer_id: v, site_address: c ? [c.address, c.city].filter(Boolean).join(", ") : "" }); }} options={customerOpts} testid="document-customer-select" placeholder="Choose customer" />
                {cust && <p className="text-xs text-slate-500">{cust.contact_name} · {cust.email} · GST {cust.gst_number || "—"}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Site / job address</Label>
                <Input value={form.site_address} onChange={(e) => set("site_address", e.target.value)} data-testid="document-site-address-input" />
              </div>
              <div className="space-y-1.5"><Label>{kind === "quote" ? "Quote date" : kind === "invoice" ? "Invoice date" : "Order date"}</Label><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} data-testid="document-date-input" /></div>
              <div className="space-y-1.5"><Label>{meta.dueLabel} date</Label><Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} data-testid="document-due-date-input" /></div>
              <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} data-testid="document-reference-input" /></div>
              <div className="space-y-1.5"><Label>Assigned to</Label><SelectField value={form.assigned_to} onChange={(v) => set("assigned_to", v)} options={userOpts} testid="document-assigned-select" /></div>
              {kind === "quote" && (
                <div className="space-y-1.5 sm:col-span-2"><Label>Customer message</Label><Textarea rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} data-testid="document-message-input" /></div>
              )}
            </div>
          </Panel>

          <Panel title="Items" actions={<Button size="sm" variant="outline" onClick={() => set("items", [...form.items, blankItem()])} data-testid="add-item-button"><Plus className="size-4" />Add item</Button>}>
            <div className="space-y-3">
              {form.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3" data-testid={`line-item-${i}`}>
                  <div className="grid gap-2 sm:grid-cols-12">
                    <Input className="sm:col-span-5" placeholder="Item / description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} data-testid={`item-${i}-description-input`} />
                    <Input className="sm:col-span-2" type="number" step="any" placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} data-testid={`item-${i}-qty-input`} />
                    <Input className="sm:col-span-2" type="number" step="any" placeholder="Unit price" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} data-testid={`item-${i}-price-input`} />
                    <Input className="sm:col-span-1" type="number" step="any" title="Discount %" value={it.discount} onChange={(e) => setItem(i, { discount: Number(e.target.value) })} data-testid={`item-${i}-discount-input`} />
                    <div className="flex items-center justify-end gap-1 sm:col-span-2">
                      <span className="text-sm font-semibold tabular-nums">{money(lineAmount(it.qty, it.unit_price, it.discount))}</span>
                      <Button size="icon-sm" variant="ghost" aria-label="Remove item" onClick={() => set("items", form.items.filter((_, k) => k !== i))} data-testid={`item-${i}-remove-button`}><Trash2 className="size-4 text-slate-400" /></Button>
                    </div>
                    <Input className="sm:col-span-12" placeholder="Detail (optional)" value={it.detail} onChange={(e) => setItem(i, { detail: e.target.value })} data-testid={`item-${i}-detail-input`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="ml-auto mt-4 w-60 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">GST (15%)</span><span className="tabular-nums">{money(gst)}</span></div>
              <div className="flex justify-between border-t pt-1 font-heading text-base font-bold"><span>Total (NZD)</span><span data-testid="document-total" className="tabular-nums">{money(subtotal + gst)}</span></div>
            </div>
          </Panel>

          <Panel title="Terms, notes & tags">
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Terms & conditions</Label><Textarea rows={4} value={form.terms} onChange={(e) => set("terms", e.target.value)} data-testid="document-terms-input" /></div>
              <div className="space-y-1.5"><Label>Internal notes</Label><Textarea rows={2} value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} data-testid="document-notes-input" /></div>
              <div className="space-y-1.5"><Label>Tags (comma separated)</Label><Input value={form.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} data-testid="document-tags-input" /></div>
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-20 rounded-xl bg-slate-100 p-3 sm:p-4">
            <p className="no-print mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
            <DocumentPreview doc={{ ...form, kind, number: doc?.number ?? "", customer_name: cust?.name ?? "", accepted_by: doc?.accepted_by, accepted_at: doc?.accepted_at, amount_paid: doc?.amount_paid, quote_number: doc?.quote_number }} />
          </div>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent data-testid="payment-dialog">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="space-y-1.5"><Label>Amount (NZD)</Label><Input type="number" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} data-testid="payment-amount-input" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} data-testid="payment-cancel-button">Cancel</Button>
            <Button onClick={() => pay.mutate(Number(payAmount), { onSuccess: () => setPayOpen(false) })} data-testid="payment-submit-button">Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
