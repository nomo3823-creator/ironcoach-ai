import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, BarChart3, Trophy, MessageCircle, Settings, Menu, X, Zap, Apple, Dumbbell, Heart, BookOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const DESKTOP_NAV = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/today", icon: Zap, label: "Today", badge: "recommendations" },
  { path: "/plan", icon: Calendar, label: "Training Plan" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/coach", icon: MessageCircle, label: "Coach Chat" },
  { path: "/race", icon: Trophy, label: "Race Hub" },
  { path: "/nutrition", icon: Apple, label: "Nutrition" },
  { path: "/strength", icon: Dumbbell, label: "Strength" },
  { path: "/recovery", icon: Heart, label: "Recovery" },
  { path: "/journal", icon: BookOpen, label: "Journal" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

const MOBILE_NAV = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/today", icon: Zap, label: "Today" },
  { path: "/coach", icon: MessageCircle, label: "Coach" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

function SidebarContent({ current, onNav, recCount }) {
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
        {DESKTOP_NAV.map(({ path, icon: Icon, label, badge }) => {
          const active = path === "/" ? current === "/" : current.startsWith(path);
          const showBadge = badge === "recommendations" && recCount > 0;
          return (
            <Link
              key={path}
              to={path}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {showBadge && <span className="ml-auto text-xs bg-destructive text-white px-2 py-0.5 rounded-full">{recCount}</span>}
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
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [recCount, setRecCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    loadRecCount();
    const interval = setInterval(loadRecCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  async function loadRecCount() {
    try {
      const recs = await base44.entities.PlanRecommendation.filter({
        created_by: currentUser.email,
        status: "pending",
      });
      setRecCount(recs?.length || 0);
    } catch (err) {
      console.error("Failed to load recommendations count", err);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-sidebar shrink-0">
        <SidebarContent current={location.pathname} recCount={recCount} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar border-r border-border">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent current={location.pathname} onNav={() => setOpen(false)} recCount={recCount} />
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
        {/* Mobile bottom nav */}
        <nav className="lg:hidden border-t border-border bg-card px-3 py-2 flex justify-around">
          {MOBILE_NAV.map(({ path, icon: Icon, label }) => {
            const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 text-xs font-medium transition-all flex-1",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}