import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Bell, Calendar, Clock, FileText, LayoutDashboard, LogOut, Menu, Plus, Receipt, Settings,
  ShieldCheck, ShoppingCart, Smartphone, Target, Users, Wrench, Flame,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, tech: false, end: true },
  { to: "/leads", label: "Leads", icon: Target, tech: false },
  { to: "/quotes", label: "Quotes", icon: FileText, tech: false },
  { to: "/sales-orders", label: "Sales Orders", icon: ShoppingCart, tech: false },
  { to: "/schedule", label: "Jobs & Schedule", icon: Calendar, tech: true },
  { to: "/people", label: "People & Timesheets", icon: Clock, tech: true },
  { to: "/invoices", label: "Billing", icon: Receipt, tech: false },
  { to: "/assets", label: "Assets", icon: Wrench, tech: true },
  { to: "/customers", label: "Customers", icon: Users, tech: true },
  { to: "/reports", label: "Reports", icon: BarChart3, tech: false },
  { to: "/forms", label: "Forms & Certificates", icon: ShieldCheck, tech: true },
  { to: "/tech", label: "Technician App", icon: Smartphone, tech: true },
  { to: "/settings", label: "Settings", icon: Settings, tech: false },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <span className="grid size-9 place-items-center rounded-lg bg-orange-600 text-white shadow-lg shadow-orange-900/30">
        <Flame className="size-5" />
      </span>
      <div>
        <p className="font-heading text-lg font-extrabold leading-none tracking-wide text-white">GASCRAFT</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Field Service CRM</p>
      </div>
    </div>
  );
}

function SideNav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
      {NAV.filter((n) => isAdmin || n.tech).map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          data-testid={`nav-${n.to === "/" ? "dashboard" : n.to.slice(1)}`}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
              isActive
                ? "border-orange-500 bg-navy-2 text-orange-400"
                : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white",
            )
          }
        >
          <n.icon className="size-4 shrink-0" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const me = useMe();
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;
  const user = me.data;
  const isAdmin = !user || user.role === "admin";

  const side = (
    <div className="flex h-full flex-col bg-navy">
      <Logo />
      <SideNav isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
      <div className="m-3 rounded-lg bg-navy-2 p-3">
        <p className="text-xs font-semibold text-white">Need help?</p>
        <p className="mt-0.5 text-[11px] text-slate-400">Office: 07 834 2200</p>
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-orange-600 text-xs font-bold text-white">
          {initials(user?.name ?? "GC")}
        </span>
        <div className="min-w-0 flex-1">
          <p data-testid="sidebar-user-name" className="truncate text-sm font-medium text-white">{user?.name ?? "…"}</p>
          <p className="text-[11px] capitalize text-slate-400">{user?.role ?? ""}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{side}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {side}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-menu-button" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" data-testid="quick-new-button" />}>
                <Plus className="size-4" /> New
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {[
                  ["Quote", "/quotes/new"], ["Job", "/schedule?new=1"], ["Customer", "/customers?new=1"],
                  ["Invoice", "/invoices/new"], ["Lead", "/leads?new=1"], ["Timesheet", "/people?new=1"],
                  ["Certificate", "/forms?new=1"],
                ].map(([l, to]) => (
                  <DropdownMenuItem key={l} onClick={() => navigate(to)} data-testid={`quick-new-${l.toLowerCase()}`}>
                    New {l}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Link to={isAdmin ? "/" : "/tech"} className="grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100" aria-label="Notifications" data-testid="notifications-link">
            <Bell className="size-4" />
          </Link>
          <Button variant="outline" size="sm" onClick={() => endSession()} data-testid="logout-button">
            <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>
        <main key={loc.pathname} className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
