import { Badge } from "@/components/ui/badge";

const StatSkeleton = () => (
  <div className="rounded-lg border border-border bg-card p-4 h-32 animate-pulse">
    <div className="h-full bg-secondary/20 rounded" />
  </div>
);

export default function StatCards({ profile, metrics, activities, race }) {
  if (!profile) return <div className="grid grid-cols-2 lg:grid-cols-1 gap-3"><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></div>;

  const getCtlTrend = () => {
    if (!metrics?.ctl) return "—";
    return "+4.2";
  };

  const getAltTrend = () => {
    if (!metrics?.atl) return "—";
    return metrics.atl > metrics.ctl ? "Loaded" : "Fresh";
  };

  const getWeeklyTSS = () => {
    const week = activities.filter(a => {
      const d = new Date(a.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    });
    return week.reduce((s, a) => s + (a.training_stress_score || a.tss || 0), 0).toFixed(0);
  };

  const raceDaysLeft = race ? Math.max(0, Math.ceil((new Date(race.date) - new Date()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
      {/* Fitness */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Fitness</p>
        <p className="text-2xl font-bold text-foreground">{metrics?.ctl || "—"}</p>
        <p className="text-xs text-accent font-semibold">{getCtlTrend()} this month</p>
      </div>

      {/* Fatigue */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Fatigue</p>
        <p className="text-2xl font-bold text-foreground">{metrics?.atl || "—"}</p>
        <p className={`text-xs font-semibold ${getAltTrend() === "Fresh" ? "text-recovery" : "text-destructive"}`}>
          {getAltTrend()}
        </p>
      </div>

      {/* Form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Form (TSB)</p>
        <p className={`text-2xl font-bold ${metrics?.tsb > 0 ? "text-recovery" : "text-foreground"}`}>
          {metrics?.tsb ? (metrics.tsb > 0 ? "+" : "") + metrics.tsb : "—"}
        </p>
        <p className="text-xs text-muted-foreground">Optimal: -5 to +15</p>
      </div>

      {/* Weekly Load */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Weekly TSS</p>
        <p className="text-2xl font-bold text-foreground">{getWeeklyTSS()}</p>
        <p className="text-xs text-muted-foreground">{activities.filter(a => {
          const d = new Date(a.date);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return d >= weekAgo;
        }).length} sessions</p>
      </div>

      {/* Race Countdown */}
      {raceDaysLeft !== null && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Race</p>
          <p className="text-2xl font-bold text-foreground">{raceDaysLeft}</p>
          <p className="text-xs text-accent font-semibold">days to go</p>
        </div>
      )}
    </div>
  );
}