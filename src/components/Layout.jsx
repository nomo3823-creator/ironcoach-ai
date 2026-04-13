import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, BarChart3, Trophy, Dumbbell, MessageCircle, Settings, Menu, X, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/plan", icon: Calendar, label: "Training Plan" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/race", icon: Trophy, label: "Race Planner" },
  { path: "/library", icon: Dumbbell, label: "Workouts" },
  { path: "/coach", icon: MessageCircle, label: "Coach Chat" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

function SidebarContent({ current, onNav }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 pb-3 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight leading-none text-foreground">IronCoach</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">AI Training</p>
        </div>
      </div>

      <nav className="flex-1 px-3 mt-2 space-y-0.5">
        {NAV.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? current === "/" : current.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 p-3 rounded-xl bg-secondary/60 border border-border">
        <p className="text-[11px] text-muted-foreground font-medium">Device Sync</p>
        <div className="flex items-center gap-3 mt-1.5">
          {["🏊", "🚴", "🏃"].map((e, i) => (
            <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{e}</span>
              <div className="h-1.5 w-1.5 rounded-full bg-recovery animate-pulse-glow" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar shrink-0">
        <SidebarContent current={location.pathname} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar border-r border-border">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent current={location.pathname} onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <button onClick={() => setOpen(true)} className="p-1.5 text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">IronCoach AI</span>
          </div>
          <div className="w-8" />
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}