import { Heart, TrendingUp, CheckCircle2, Sparkles, Timer, Calendar } from "lucide-react";

const READINESS_BANDS = [
  { min: 85, max: 100, label: "Peak", color: "#10b981" },
  { min: 70, max: 84, label: "High", color: "#10b981" },
  { min: 55, max: 69, label: "Moderate", color: "#f59e0b" },
  { min: 40, max: 54, label: "Low", color: "#f97316" },
  { min: 20, max: 39, label: "Very Low", color: "#ef4444" },
  { min: 0, max: 19, label: "Rest", color: "#ef4444" },
];

export default function QuickStats({ stats }) {
  const readinessBand = READINESS_BANDS.find(b => stats.readinessScore != null && stats.readinessScore >= b.min && stats.readinessScore <= b.max);
  
  const tsbState = stats.tsb != null ? (
    stats.tsb > 5 ? { label: "Fresh", color: "#10b981" } :
    stats.tsb >= -5 ? { label: "Neutral", color: "#f59e0b" } :
    stats.tsb >= -20 ? { label: "Fatigued", color: "#f97316" } :
    { label: "Overreached", color: "#ef4444" }
  ) : null;

  const complianceState = stats.weekCompliance != null ? (
    stats.weekCompliance >= 80 ? { color: "#10b981" } :
    stats.weekCompliance >= 50 ? { color: "#f59e0b" } :
    { color: "#ef4444" }
  ) : null;

  const items = [
    {
      label: "Weekly Volume",
      value: `${(stats.weeklyHours || 0).toFixed(1)}h`,
      sub: `of ${(stats.plannedHours || 0).toFixed(1)}h planned`,
      icon: Timer,
      color: "#0ea5e9",
      progress: stats.plannedHours ? Math.min(100, (stats.weeklyHours / stats.plannedHours) * 100) : 0,
    },
    {
      label: "Days to Race",
      value: stats.daysToRace != null ? stats.daysToRace : "—",
      sub: stats.raceName || "No race set",
      icon: Calendar,
      color: "#f59e0b",
    },
    {
      label: "Readiness",
      value: stats.readinessScore != null ? Math.round(stats.readinessScore) : "—",
      sub: readinessBand?.label || "—",
      icon: Heart,
      color: readinessBand?.color || "#6b7280",
      valueColor: readinessBand?.color || "inherit",
    },
    {
      label: "Form / TSB",
      value: stats.tsb != null ? `${stats.tsb > 0 ? "+" : ""}${Math.round(stats.tsb)}` : "—",
      sub: tsbState?.label || "—",
      icon: TrendingUp,
      color: tsbState?.color || "#6b7280",
      valueColor: tsbState?.color || "inherit",
    },
    {
      label: "Week Compliance",
      value: `${stats.weekCompliance ?? "—"}%`,
      sub: stats.weekCompliance != null ? `${stats.weekCompliance}% of sessions done` : "— of — done",
      icon: CheckCircle2,
      color: complianceState?.color || "#6b7280",
      valueColor: complianceState?.color || "inherit",
    },
    {
      label: "Coach Recs",
      value: stats.pendingRecsCount > 0 ? stats.pendingRecsCount : "✓",
      sub: stats.pendingRecsCount > 0 ? `recommendation${stats.pendingRecsCount > 1 ? "s" : ""} waiting` : "All up to date",
      icon: Sparkles,
      color: stats.pendingRecsCount > 0 ? "#f59e0b" : "#10b981",
      valueColor: stats.pendingRecsCount > 0 ? "#f59e0b" : "#10b981",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
            <item.icon className="h-4 w-4" style={{ color: item.color }} />
          </div>
          <div className="text-2xl font-bold text-foreground" style={{ color: item.valueColor || "inherit" }}>
            {item.value}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sub}</p>
          {item.progress != null && (
            <div className="mt-2 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-full transition-all" style={{ width: `${item.progress}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}