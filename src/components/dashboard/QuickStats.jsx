import { Timer, Calendar, TrendingUp, Activity } from "lucide-react";

export default function QuickStats({ stats }) {
  const items = [
    { label: "Weekly Volume", value: stats.weeklyHours ? `${stats.weeklyHours.toFixed(1)}h` : "—", sub: stats.plannedHours ? `of ${stats.plannedHours.toFixed(1)}h` : "this week", icon: Timer, color: "#0ea5e9" },
    { label: "Days to Race", value: stats.daysToRace != null ? stats.daysToRace : "—", sub: stats.raceName || "No race set", icon: Calendar, color: "#f59e0b" },
    { label: "CTL (Fitness)", value: stats.ctl ? Math.round(stats.ctl) : "—", sub: "Chronic Load", icon: TrendingUp, color: "#14b8a6" },
    { label: "This Week", value: stats.activitiesThisWeek ?? "—", sub: "activities", icon: Activity, color: "#ef4444" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
            <item.icon className="h-4 w-4" style={{ color: item.color }} />
          </div>
          <div className="text-2xl font-bold text-foreground">{item.value}</div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}