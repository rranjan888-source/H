import { useState } from "react";
import { Building2, ClipboardList, Pencil, Plus, Plug, Search, Trash2, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import XeroPanel from "@/components/XeroPanel";
import { useList, useMe, useRemove, useSave } from "@/lib/hooks";
import type { User, UserIn } from "@/lib/types";
import { COMPANY } from "@/components/DocumentPreview";
import { EntityDialog, type FieldDef } from "@/components/EntityDialog";
import { Field, PageHeader, Panel } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { JOB_STATUSES, JOB_TYPES } from "@/pages/Schedule";
import { FORM_NAMES } from "@/pages/Forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BLANK: UserIn = { name: "", email: "", role: "technician", title: "Technician", phone: "", status: "Active", vehicle: "", password: "" };

export default function Settings() {
  const me = useMe().data;
  const [params] = useSearchParams();
  const { data: users = [] } = useList<User>("/users");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const save = useSave<UserIn, User>("/users", "Team member");
  const remove = useRemove("/users", "Team member");
  const fields: FieldDef[] = [
    { name: "name", label: "Full name", required: true }, { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone" },
    { name: "role", label: "Access role", type: "select", options: [{ value: "admin", label: "Admin (full access)" }, { value: "technician", label: "Technician (field app)" }] },
    { name: "title", label: "Job title", type: "select", options: ["Senior Technician", "Technician", "Apprentice", "Service Manager", "Office/Admin", "Administrator"] },
    { name: "status", label: "Status", type: "select", options: ["Active", "On Leave", "Inactive"] },
    { name: "vehicle", label: "Assigned vehicle" },
    { name: "password", label: editing === "new" ? "Password" : "New password (leave blank to keep)", type: "password", required: editing === "new" },
  ];
  const rows = users.filter((u) => `${u.name} ${u.email} ${u.title}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Settings" subtitle="Manage your team, job options, forms and company details." />
      <Tabs defaultValue={params.get("tab") ?? "team"}>
        <TabsList className="mb-4">
          <TabsTrigger value="team" data-testid="settings-tab-team"><Users className="size-4" />Team & users</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="settings-tab-jobs"><ClipboardList className="size-4" />Job & form settings</TabsTrigger>
          <TabsTrigger value="company" data-testid="settings-tab-company"><Building2 className="size-4" />Company</TabsTrigger>
          <TabsTrigger value="integrations" data-testid="settings-tab-integrations"><Plug className="size-4" />Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="team">
          <Panel title={`Team members (${users.length})`} actions={me?.role === "admin" && <Button size="sm" onClick={() => setEditing("new")} data-testid="add-user-button"><Plus className="size-4" />Add team member</Button>}>
            <div className="relative mb-4 max-w-xs"><Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" /><Input className="pl-8" placeholder="Search team…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="user-search-input" /></div>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Vehicle</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id} data-testid={`user-row-${u.email}`}>
                    <TableCell className="font-medium">{u.name}</TableCell><TableCell>{u.title}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell><TableCell>{u.phone}</TableCell><TableCell className="text-slate-500">{u.email}</TableCell>
                    <TableCell><StatusBadge status={u.status} /></TableCell><TableCell className="font-mono text-xs">{u.vehicle || "—"}</TableCell>
                    <TableCell className="text-right">
                      {me?.role === "admin" && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(u)} data-testid={`edit-user-${u.email}`}><Pencil className="size-4" /></Button>
                          {u.id !== me.id && <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => { if (confirm(`Remove ${u.name}?`)) remove.mutate(u.id); }} data-testid={`delete-user-${u.email}`}><Trash2 className="size-4 text-red-700" /></Button>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>
        <TabsContent value="jobs" className="grid gap-6 md:grid-cols-3">
          {[["Job types", JOB_TYPES], ["Job statuses", JOB_STATUSES], ["Form & certificate templates", FORM_NAMES]].map(([t, list]) => (
            <Panel key={t as string} title={t as string}>
              <ul className="space-y-1.5 text-sm">{(list as string[]).map((x) => <li key={x} className="rounded-md bg-slate-50 px-3 py-1.5">{x}</li>)}</ul>
            </Panel>
          ))}
        </TabsContent>
        <TabsContent value="integrations"><XeroPanel /></TabsContent>
        <TabsContent value="company">
          <Panel title="Company details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name">{COMPANY.name}</Field><Field label="GST number">{COMPANY.gst_number}</Field>
              <Field label="Address">{COMPANY.address}</Field><Field label="Phone">{COMPANY.phone}</Field>
              <Field label="Email">{COMPANY.email}</Field><Field label="Default GST rate">15%</Field>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
      <EntityDialog<UserIn> open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add team member" : "Edit team member"}
        fields={fields} initial={editing && editing !== "new" ? { ...editing, password: "" } : BLANK} prefix="user-form" pending={save.isPending}
        onSubmit={(v) => save.mutateAsync({ id: editing && editing !== "new" ? editing.id : undefined, body: { ...v, password: v.password || null } })} />
    </div>
  );
}
