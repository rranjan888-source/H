import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Opt = { value: string; label: string };
export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "textarea" | "select" | "email" | "password";
  options?: (Opt | string)[];
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
}

type Values = Record<string, unknown>;
const NONE = "__none";
const norm = (o: Opt | string): Opt => (typeof o === "string" ? { value: o, label: o } : o);

export function SelectField({
  value, onChange, options, testid, placeholder,
}: { value: string; onChange: (v: string) => void; options: (Opt | string)[]; testid: string; placeholder?: string }) {
  const opts = options.map(norm);
  const labels = Object.fromEntries(opts.map((o) => [o.value || NONE, o.label]));
  return (
    <Select value={value || NONE} onValueChange={(v: string) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger data-testid={testid} className="w-full">
        <SelectValue>{(v) => labels[v as string] ?? placeholder ?? "Select…"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value || NONE} value={o.value || NONE} data-testid={`${testid}-option-${(o.value || "none").replace(/\s+/g, "-").toLowerCase()}`}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EntityForm({
  fields, values, setValues, prefix,
}: { fields: FieldDef[]; values: Values; setValues: (v: Values) => void; prefix: string }) {
  const set = (k: string, v: unknown) => setValues({ ...values, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `${prefix}-${f.name.replace(/_/g, "-")}`;
        const v = values[f.name];
        return (
          <div key={f.name} className={cn("space-y-1.5", (f.wide || f.type === "textarea") && "sm:col-span-2")}>
            <Label htmlFor={id} className="text-xs font-medium text-slate-600">
              {f.label}
              {f.required && <span className="text-orange-600"> *</span>}
            </Label>
            {f.type === "select" ? (
              <SelectField value={String(v ?? "")} onChange={(x) => set(f.name, x)} options={f.options ?? []} testid={`${id}-select`} />
            ) : f.type === "textarea" ? (
              <Textarea id={id} data-testid={`${id}-input`} rows={3} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
            ) : (
              <Input
                id={id}
                data-testid={`${id}-input`}
                type={f.type ?? "text"}
                step={f.type === "number" ? "any" : undefined}
                required={f.required}
                placeholder={f.placeholder}
                value={v === undefined || v === null ? "" : String(v)}
                onChange={(e) => set(f.name, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EntityDialog<T>({
  open, onOpenChange, title, fields, initial, onSubmit, prefix, submitLabel = "Save", pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  fields: FieldDef[];
  initial: object;
  onSubmit: (v: T) => Promise<unknown>;
  prefix: string;
  submitLabel?: string;
  pending?: boolean;
}) {
  const [values, setValues] = useState<Values>(initial as Values);
  // Reset the form each time the dialog opens (initial may be a fresh object every render).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues(initial as Values);
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const out: Values = { ...values };
    for (const f of fields) if (f.type === "number") out[f.name] = Number(out[f.name] || 0);
    await onSubmit(out as T);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid={`${prefix}-dialog`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => submit(e).catch(() => undefined)} className="space-y-5">
          <EntityForm fields={fields} values={values} setValues={setValues} prefix={prefix} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid={`${prefix}-cancel-button`}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} data-testid={`${prefix}-submit-button`}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
