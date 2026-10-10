import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 data-testid="page-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label, value, icon: Icon, hint, tone = "orange", testid,
}: { label: string; value: ReactNode; icon?: LucideIcon; hint?: ReactNode; tone?: string; testid?: string }) {
  const tones: Record<string, string> = {
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-sky-50 text-sky-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
    yellow: "bg-yellow-50 text-yellow-700",
  };
  return (
    <div
      data-testid={testid}
      className="animate-rise rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-colors duration-150 hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg", tones[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-heading text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Panel({
  title, actions, children, className, testid,
}: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; testid?: string }) {
  return (
    <section data-testid={testid} className={cn("animate-rise rounded-xl border border-slate-200/80 bg-white shadow-xs", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ text, testid }: { text: string; testid?: string }) {
  return (
    <div data-testid={testid} className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 truncate text-sm text-slate-800">{children || "—"}</div>
    </div>
  );
}
