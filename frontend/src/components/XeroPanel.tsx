import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Link2, RefreshCw, Unplug } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg, useAction, useItem } from "@/lib/hooks";
import type { XeroConnectUrl, XeroStatus, XeroSyncResult } from "@/lib/types";
import { ago } from "@/lib/format";
import { Panel } from "@/components/Page";
import { Button } from "@/components/ui/button";

export function useXeroStatus() {
  return useItem<XeroStatus>("/xero/status");
}

// Small "Sync to Xero" control used on invoice and customer detail views.
export function XeroSyncButton({ path, label, synced, testid }: { path: string; label: string; synced: boolean; testid: string }) {
  const status = useXeroStatus().data;
  const sync = useAction(() => apiPost(path), `${label} synced to Xero`);
  if (!status?.connected) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending} data-testid={testid}>
      <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
      {sync.isPending ? "Syncing…" : synced ? "Re-sync Xero" : "Sync to Xero"}
    </Button>
  );
}

export function XeroBadge({ id, status, error }: { id: string; status?: string; error?: string }) {
  if (error) return <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700" title={error} data-testid="xero-error-badge">Xero error: {error.slice(0, 60)}</span>;
  if (!id) return null;
  return <span className="rounded bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700" data-testid="xero-synced-badge">Xero · {status || "Linked"}</span>;
}

export default function XeroPanel() {
  const [params] = useSearchParams();
  const { data: st } = useXeroStatus();
  const [last, setLast] = useState<XeroSyncResult | null>(null);
  const [flagShown, setFlagShown] = useState(false);
  const sync = useAction(() => apiPost<XeroSyncResult>("/xero/sync"), "Xero sync complete");
  const disconnect = useAction(() => apiPost("/xero/disconnect"), "Xero disconnected");
  const flag = params.get("xero");
  if (flag && !flagShown) {
    setFlagShown(true);
    if (flag === "connected") toast.success("Xero connected");
    else toast.error("Xero connection failed. Please try again.");
  }
  const connect = async () => {
    try {
      const { url } = await apiGet<XeroConnectUrl>("/xero/connect");
      window.location.assign(url);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const result = last ?? st?.last_sync ?? null;

  return (
    <Panel title={<span className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#13B5EA] text-xs font-bold text-white">x</span>Xero accounting</span>} testid="xero-panel">
      {!st ? <div className="h-24 animate-pulse rounded-lg bg-slate-100" /> : !st.configured ? (
        <div className="space-y-3 text-sm text-slate-600" data-testid="xero-not-configured">
          <p className="font-semibold text-slate-900">Xero isn't set up yet</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Go to <a className="text-orange-600 underline" href="https://developer.xero.com/app/manage" target="_blank" rel="noreferrer">developer.xero.com/app/manage</a> and create a <b>Web app</b>.</li>
            <li>Set the redirect URI to <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs" data-testid="xero-redirect-uri">{st.redirect_uri}</code></li>
            <li>Send the Client ID and Client Secret to your developer to add to the app settings.</li>
          </ol>
        </div>
      ) : !st.connected ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">Connect your Xero organisation to sync customers and invoices and pull payments back.</p>
          <Button onClick={connect} data-testid="xero-connect-button"><Link2 className="size-4" />Connect Xero</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-green-600" />Connected to <b data-testid="xero-tenant-name">{st.tenant_name}</b></p>
            <div className="flex gap-2">
              <Button onClick={() => sync.mutate(undefined, { onSuccess: setLast })} disabled={sync.isPending} data-testid="xero-sync-now-button">
                <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />{sync.isPending ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="outline" onClick={() => { if (confirm("Disconnect Xero?")) disconnect.mutate(); }} data-testid="xero-disconnect-button"><Unplug className="size-4" />Disconnect</Button>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>Sent invoices sync automatically to Xero as <b>Awaiting Payment</b>, with GST 15% (account {"200"} Sales).</li>
            <li>"Sync now" imports Xero contacts as customers, pushes customers & sent invoices, and marks invoices paid in Xero as Paid here.</li>
          </ul>
          {result && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-5" data-testid="xero-last-sync">
              <p><b>{result.imported_customers}</b> contacts imported</p>
              <p><b>{result.pushed_customers}</b> customers pushed</p>
              <p><b>{result.pushed_invoices}</b> invoices pushed</p>
              <p><b>{result.payments_updated}</b> payments updated</p>
              <p className={result.invoice_errors ? "text-red-700" : ""}><b>{result.invoice_errors}</b> errors · {ago(result.at)}</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
