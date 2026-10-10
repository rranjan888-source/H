import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  yellow: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
};

const STATUS_TONE: Record<string, string> = {
  Scheduled: "blue", Sent: "blue", Confirmed: "blue", Contacted: "blue", "On Road": "green",
  "In Progress": "orange", "In Use": "orange", Qualified: "orange", "Calibration Due": "red",
  Pending: "yellow", Unscheduled: "yellow", "In Service": "yellow", "On Leave": "yellow",
  Completed: "green", Accepted: "green", Paid: "green", Approved: "green", Won: "green", Active: "green",
  Available: "green", Invoiced: "sky", Converted: "sky", New: "sky", Billable: "green",
  Draft: "slate", Inactive: "slate", Cancelled: "slate", "Non-Billable": "slate", Travel: "blue",
  Overdue: "red", Expired: "red", Lost: "red", Declined: "red", "Off Road": "red", High: "red",
  Medium: "yellow", Low: "slate",
};

export function StatusBadge({ status, className, testid }: { status: string; className?: string; testid?: string }) {
  const tone = TONES[STATUS_TONE[status] ?? "slate"];
  return (
    <span
      data-testid={testid}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
