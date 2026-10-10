import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Clock, Plus, Timer, X } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useAction, useItem, useList, useLookups, useMe, useRemove, useSave, useToday } from "@/lib/hooks";
import type { Leave, LeaveIn, Timesheet, TimesheetIn } from "@/lib/types";
import { fmtDate, initials } from "@/lib/format";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { Empty, KpiCard, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}

export function ClockWidget() {
  const status = useItem<Timesheet | null>("/clock/status");
  const clockIn = useAction(() => apiPost<Timesheet>("/clock/in", { job_number: "", activity: "", type: "Billable" }), "Clocked in");
  const clockOut = useAction(() => apiPost<Timesheet>("/clock/out"), (r) => `Clocked out · ${r.hours}h logged`);
  const open = status.data;
  return open ? (
    <Button variant="outline" className="border-green-300 bg-green-50 text-green-800" onClick={() => clockOut.mutate()} data-testid="clock-out-button">
      <Timer className="size-4 animate-pulse" />Clocked in {fmtDate(open.clock_in, "h:mm a")} · Clock out
    </Button>
  ) : (
    <Button variant="outline" onClick={() => clockIn.mutate()} data-testid="clock-in-button"><Clock className="size-4" />Clock in</Button>
  );
}

export default function People() {
  const today = useToday();
  const me = useMe().data;
  const isAdmin = me?.role === "admin";
  const [params, setParams] = useSearchParams();
  const { users, staffOpts } = useLookups();
  const { data: entries = [] } = useList<Timesheet>("/timesheets");
  const { data: leave = [] } = useList<Leave>("/leave");
  const [weekOffset, setWeekOffset] = useState(0);
  const [entryOpen, setEntryOpen] = useState(!!params.get("new"));
  const [leaveOpen, setLeaveOpen] = useState(false);
  const saveEntry = useSave<TimesheetIn, Timesheet>("/timesheets", "Time entry");
  const removeEntry = useRemove("/timesheets", "Time entry");
  const saveLeave = useSave<LeaveIn, Leave>("/leave", "Leave request");

  const monday = today ? addDays(mondayOf(today), weekOffset * 7) : "";
  const days = monday ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [];
  const weekEntries = entries.filter((e) => days.includes(e.date) && !e.open);
  const total = weekEntries.reduce((a, e) => a + e.hours, 0);
  const billable = weekEntries.filter((e) => e.type === "Billable").reduce((a, e) => a + e.hours, 0);
  const onLeave = (uid: string, d: string) => leave.find((l) => l.user_id === uid && l.status === "Approved" && l.start_date <= d && (l.end_date || l.start_date) >= d);
  const chart = days.map((d) => ({
    day: fmtDate(d, "EEE"),
    Billable: weekEntries.filter((e) => e.date === d && e.type === "Billable").reduce((a, e) => a + e.hours, 0),
    "Non-billable": weekEntries.filter((e) => e.date === d && e.type !== "Billable").reduce((a, e) => a + e.hours, 0),
  }));

  const entryFields: FieldDef[] = [
    { name: "user_id", label: "Team member", type: "select", options: staffOpts, required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "hours", label: "Hours", type: "number", required: true },
    { name: "type", label: "Type", type: "select", options: ["Billable", "Non-Billable", "Travel", "Break"] },
    { name: "job_number", label: "Job # (optional)" },
    { name: "activity", label: "Activity" },
  ];
  const leaveFields: FieldDef[] = [
    { name: "user_id", label: "Team member", type: "select", options: staffOpts, required: true },
    { name: "type", label: "Leave type", type: "select", options: ["Annual Leave", "Sick Leave", "RDO", "Training", "Unpaid"] },
    { name: "start_date", label: "Start", type: "date", required: true },
    { name: "end_date", label: "End", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="People & Timesheets" subtitle="Manage your team, track time and leave."
        actions={<>
          <ClockWidget />
          <Button variant="outline" onClick={() => setLeaveOpen(true)} data-testid="request-leave-button"><Plus className="size-4" />Request leave</Button>
          <Button onClick={() => setEntryOpen(true)} data-testid="manual-entry-button"><Plus className="size-4" />Manual entry</Button>
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total hours (week)" value={total.toFixed(1)} testid="people-kpi-total-hours" />
        <KpiCard label="Billable hours" value={billable.toFixed(1)} hint={total ? `${Math.round((billable / total) * 100)}% of total` : ""} tone="green" testid="people-kpi-billable" />
        <KpiCard label="Team members" value={users.length} tone="blue" testid="people-kpi-team" />
        <KpiCard label="Leave requests pending" value={leave.filter((l) => l.status === "Pending").length} tone="yellow" testid="people-kpi-leave" />
      </div>

      <Tabs defaultValue="timesheets">
        <TabsList className="mb-4">
          <TabsTrigger value="timesheets" data-testid="tab-timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
          <TabsTrigger value="leave" data-testid="tab-leave">Leave</TabsTrigger>
        </TabsList>
        <TabsContent value="timesheets" className="space-y-6">
          <Panel title={monday ? `Week ${fmtDate(monday, "d MMM")} – ${fmtDate(addDays(monday, 6), "d MMM yyyy")}` : "Week"}
            actions={<div className="flex gap-1">
              <Button size="icon-sm" variant="outline" onClick={() => setWeekOffset(weekOffset - 1)} data-testid="week-prev" aria-label="Previous week"><ChevronLeft className="size-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setWeekOffset(0)} data-testid="week-current">This week</Button>
              <Button size="icon-sm" variant="outline" onClick={() => setWeekOffset(weekOffset + 1)} data-testid="week-next" aria-label="Next week"><ChevronRight className="size-4" /></Button>
            </div>}>
            <Table data-testid="timesheet-grid">
              <TableHeader><TableRow><TableHead>Team member</TableHead>{days.map((d) => <TableHead key={d} className="text-center">{fmtDate(d, "EEE d")}</TableHead>)}<TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.map((u) => {
                  const mine = weekEntries.filter((e) => e.user_id === u.id);
                  return (
                    <TableRow key={u.id} data-testid={`timesheet-row-${u.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      <TableCell><p className="font-medium">{u.name}</p><p className="text-[11px] text-slate-500">{u.title}</p></TableCell>
                      {days.map((d) => {
                        const h = mine.filter((e) => e.date === d).reduce((a, e) => a + e.hours, 0);
                        return <TableCell key={d} className="text-center tabular-nums">{onLeave(u.id, d) ? <span className="text-xs font-semibold text-yellow-700">Leave</span> : h ? `${h.toFixed(1)}h` : <span className="text-slate-300">–</span>}</TableCell>;
                      })}
                      <TableCell className="text-right font-semibold tabular-nums">{mine.reduce((a, e) => a + e.hours, 0).toFixed(1)}h</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Billable vs non-billable">
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94A3B8" /><YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Billable" stackId="a" fill="#EA580C" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Non-billable" stackId="a" fill="#0284C7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Recent entries">
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableBody>
                    {entries.slice(0, 30).map((e) => (
                      <TableRow key={e.id} data-testid={`time-entry-${e.id}`}>
                        <TableCell className="text-xs">{fmtDate(e.date, "d MMM")}</TableCell>
                        <TableCell className="text-sm font-medium">{e.user_name}</TableCell>
                        <TableCell className="text-xs text-slate-500">{e.job_number || e.activity}</TableCell>
                        <TableCell className="tabular-nums">{e.open ? "Running" : `${e.hours}h`}</TableCell>
                        <TableCell><StatusBadge status={e.type} /></TableCell>
                        <TableCell>{isAdmin && <Button size="icon-xs" variant="ghost" aria-label="Delete entry" onClick={() => removeEntry.mutate(e.id)} data-testid={`delete-entry-${e.id}`}><X className="size-3" /></Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {users.map((u) => {
              const l = today ? onLeave(u.id, today) : undefined;
              return (
                <div key={u.id} className="animate-rise rounded-xl border border-slate-200 bg-white p-4" data-testid={`team-card-${u.name.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-navy text-sm font-bold text-white">{initials(u.name)}</span>
                    <div className="min-w-0"><p className="truncate font-semibold">{u.name}</p><p className="text-xs text-slate-500">{u.title}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{u.phone}</span>
                    <StatusBadge status={l ? "On Leave" : u.status} />
                  </div>
                  {u.vehicle && <p className="mt-2 font-mono text-[11px] text-slate-500">Vehicle {u.vehicle}</p>}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="leave">
          <Panel title="Leave & absences">
            {leave.length === 0 ? <Empty text="No leave requests" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Team member</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Notes</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {leave.map((l) => (
                    <TableRow key={l.id} data-testid={`leave-row-${l.id}`}>
                      <TableCell className="font-medium">{l.user_name}</TableCell>
                      <TableCell>{l.type}</TableCell>
                      <TableCell>{fmtDate(l.start_date)}{l.end_date && l.end_date !== l.start_date ? ` – ${fmtDate(l.end_date)}` : ""}</TableCell>
                      <TableCell className="text-slate-500">{l.notes}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell className="text-right">
                        {isAdmin && l.status === "Pending" && (
                          <div className="flex justify-end gap-1">
                            <Button size="icon-sm" variant="outline" aria-label="Approve" data-testid={`approve-leave-${l.id}`} onClick={() => saveLeave.mutate({ id: l.id, body: { ...l, status: "Approved" } })}><Check className="size-4 text-green-700" /></Button>
                            <Button size="icon-sm" variant="outline" aria-label="Decline" data-testid={`decline-leave-${l.id}`} onClick={() => saveLeave.mutate({ id: l.id, body: { ...l, status: "Declined" } })}><X className="size-4 text-red-700" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <EntityDialog<TimesheetIn> open={entryOpen} onOpenChange={(o) => { setEntryOpen(o); if (!o) setParams({}); }} title="Manual time entry" fields={entryFields}
        initial={{ user_id: me?.id ?? "", date: today, hours: 8, type: "Billable", job_number: "", activity: "" }} prefix="time-entry-form"
        pending={saveEntry.isPending} onSubmit={(v) => saveEntry.mutateAsync({ body: v })} />
      <EntityDialog<LeaveIn> open={leaveOpen} onOpenChange={setLeaveOpen} title="Request leave" fields={leaveFields}
        initial={{ user_id: me?.id ?? "", type: "Annual Leave", start_date: today, end_date: today, status: "Pending", notes: "" }} prefix="leave-form"
        pending={saveLeave.isPending} onSubmit={(v) => saveLeave.mutateAsync({ body: v })} />
    </div>
  );
}
