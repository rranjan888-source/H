import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, ShieldCheck, CalendarCheck, Receipt } from "lucide-react";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errMsg } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO = [
  { label: "Admin", email: "admin@gascraft.co.nz", password: "Admin@123" },
  { label: "Technician", email: "michael@gascraft.co.nz", password: "Tech@123" },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await apiPost<User>("/auth/login", { email, password });
      beginSession();
      navigate(u.role === "admin" ? "/" : "/tech", { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="absolute -bottom-32 left-10 size-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-orange-600"><Flame className="size-6" /></span>
          <span className="font-heading text-2xl font-extrabold tracking-wide">GASCRAFT</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-heading text-4xl font-bold leading-tight">Every quote, job and certificate — in one place.</h1>
          <p className="mt-4 text-slate-300">Quote it, schedule it, certify it and get paid. Built for NZ gas and heating trades.</p>
          <div className="mt-10 space-y-4 text-sm text-slate-300">
            {[
              [CalendarCheck, "Dispatch your team from a live schedule"],
              [ShieldCheck, "Issue gas safety certificates on site"],
              [Receipt, "Online quote acceptance & fast invoicing"],
            ].map(([Icon, t], i) => {
              const I = Icon as typeof Flame;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/10"><I className="size-4 text-orange-400" /></span>
                  {t as string}
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">© GasCraft Ltd · Hamilton, New Zealand</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise space-y-5" data-testid="login-form">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Welcome back. Use your GasCraft account.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password-input" />
          </div>
          {error && <p className="text-sm text-red-700" data-testid="login-error">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={busy} data-testid="login-submit-button">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Demo accounts</p>
            <div className="mt-2 flex gap-2">
              {DEMO.map((d) => (
                <Button key={d.label} type="button" variant="outline" size="sm" className="flex-1"
                  data-testid={`login-demo-${d.label.toLowerCase()}`}
                  onClick={() => { setEmail(d.email); setPassword(d.password); }}>
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
