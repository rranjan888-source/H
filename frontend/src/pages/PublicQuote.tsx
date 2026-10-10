import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Flame, PenLine } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/hooks";
import type { PublicQuote as PublicQuoteT } from "@/lib/types";
import { fmtDate, money } from "@/lib/format";
import { DocumentPreview } from "@/components/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PublicQuote() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const key = ["public-quote", id];
  const { data, error, isLoading } = useQuery({ queryKey: key, queryFn: () => apiGet<PublicQuoteT>(`/public/quotes/${id}`), retry: false });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const accept = useMutation({
    mutationFn: () => apiPost<PublicQuoteT>(`/public/quotes/${id}/accept`, { name, signature }),
    onSuccess: (r) => { qc.setQueryData(key, r); setOpen(false); },
    onError: (e) => setErr(errMsg(e)),
  });
  const q = data?.quote;
  const accepted = q && ["Accepted", "Converted"].includes(q.status);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-orange-600"><Flame className="size-5" /></span><span className="font-heading text-lg font-extrabold tracking-wide">GASCRAFT</span></div>
          <span className="text-sm text-slate-300">Secure quote approval</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        {isLoading && <div className="h-96 animate-pulse rounded-xl bg-white" />}
        {error && <div className="rounded-xl bg-white p-10 text-center" data-testid="public-quote-error"><p className="text-lg font-semibold">Quote not available</p><p className="mt-1 text-sm text-slate-500">This link may be invalid. Please contact GasCraft on 07 834 2200.</p></div>}
        {q && data && (
          <>
            <div className="animate-rise flex flex-col gap-4 rounded-xl bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">Quote {q.number} for {data.customer.name}</p>
                <p className="font-heading text-3xl font-extrabold" data-testid="public-quote-total">{money(q.total)} <span className="text-sm font-medium text-slate-500">incl. GST</span></p>
                <p className="text-sm text-slate-500">Valid until {fmtDate(q.due_date)}</p>
              </div>
              {accepted ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-green-800" data-testid="public-quote-accepted">
                  <CheckCircle2 className="size-5" /><div><p className="font-semibold">Quote accepted — thank you!</p><p className="text-xs">We'll be in touch to schedule your job{q.job_number ? ` (${q.job_number})` : ""}.</p></div>
                </div>
              ) : q.status === "Sent" ? (
                <Button size="lg" onClick={() => { setName(data.customer.contact_name); setOpen(true); }} data-testid="public-accept-button"><PenLine className="size-4" />Accept quote</Button>
              ) : (
                <p className="text-sm font-medium text-slate-500">This quote is {q.status.toLowerCase()}.</p>
              )}
            </div>
            <DocumentPreview doc={q} company={data.company} />
          </>
        )}
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="accept-dialog">
          <DialogHeader><DialogTitle>Accept & sign quote {q?.number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="accept-name-input" /></div>
            <div className="space-y-1.5"><Label>Signature (type your name)</Label><Input className="font-heading text-xl italic" value={signature} onChange={(e) => setSignature(e.target.value)} data-testid="accept-signature-input" /></div>
            <label className="flex items-start gap-2 text-sm text-slate-600"><Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} data-testid="accept-terms-checkbox" />I accept this quote of {q ? money(q.total) : ""} and the terms & conditions.</label>
            {err && <p className="text-sm text-red-700" data-testid="accept-error">{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="accept-cancel-button">Cancel</Button>
            <Button disabled={!agree || !name.trim() || !signature.trim() || accept.isPending} onClick={() => { setErr(""); accept.mutate(); }} data-testid="accept-confirm-button">{accept.isPending ? "Submitting…" : "Accept quote"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
