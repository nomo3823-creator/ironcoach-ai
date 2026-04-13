import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sportColors } from "@/lib/sportUtils";
import { formatDistance } from "@/lib/unitConversions";
import moment from "moment";

export default function TodaySessionCard({ workout, readiness, activities }) {
  const today = new Date().toISOString().split("T")[0];
  const completedToday = activities.find(a => a.date === today);

  if (completedToday) {
    // STATE D: SESSION COMPLETED
    const color = sportColors[completedToday.sport];
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge className="bg-recovery/20 text-recovery border-0">Completed</Badge>
            <p className="text-xl font-bold text-foreground mt-2">{completedToday.title}</p>
          </div>
          <div className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: color.hex + "15" }}>
            {completedToday.sport === "swim" ? "🏊" : completedToday.sport === "bike" ? "🚴" : completedToday.sport === "run" ? "🏃" : "⚡"}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Duration</p>
            <p className="font-semibold text-foreground">{completedToday.duration_minutes}min</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Avg HR</p>
            <p className="font-semibold text-foreground">{completedToday.avg_hr}bpm</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">TSS</p>
            <p className="font-semibold text-foreground">{completedToday.tss || 0}</p>
          </div>
        </div>

        {completedToday.distance_km && (
          <div className="text-sm">
            <p className="text-muted-foreground text-xs">Distance</p>
            <p className="font-semibold text-foreground">{formatDistance(completedToday.distance_km)}</p>
          </div>
        )}

        <Button className="w-full">View full analysis</Button>
      </div>
    );
  }

  if (!workout) {
    // STATE C: REST DAY
    const yesterday = activities.find(a => a.date === moment().subtract(1, "day").format("YYYY-MM-DD"));
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="text-center py-4">
          <p className="text-2xl font-bold text-foreground">Rest Day</p>
          <p className="text-sm text-muted-foreground mt-1">Recovery is training.</p>
        </div>

        {yesterday && (
          <div className="bg-secondary/30 rounded-lg p-3 text-sm space-y-1">
            <p className="text-muted-foreground text-xs">Yesterday</p>
            <p className="font-semibold text-foreground">{yesterday.title}</p>
            <p className="text-xs text-muted-foreground">
              {yesterday.distance_km ? `${formatDistance(yesterday.distance_km)} · ` : ""}{yesterday.duration_minutes}min · {yesterday.tss || 0} TSS
            </p>
          </div>
        )}

        <Button variant="outline" className="w-full">View recovery tips</Button>
      </div>
    );
  }

  // STATE A or B: SESSION PLANNED / RECOMMENDED
  const color = sportColors[workout.sport];
  const shouldRecommend = readiness && readiness.score < 55;

  return (
    <div className={`rounded-2xl border-2 p-6 space-y-4 ${shouldRecommend ? "border-accent bg-secondary/20" : "border-border bg-card"}`}>
      {shouldRecommend && <Badge className="bg-accent/20 text-accent border-0">Coach Recommendation</Badge>}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold text-foreground">{workout.title}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{workout.intensity}</Badge>
            <Badge variant="secondary" className="text-xs">{workout.duration_minutes}min</Badge>
          </div>
        </div>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: color.hex + "15" }}>
          {workout.sport === "swim" ? "🏊" : workout.sport === "bike" ? "🚴" : workout.sport === "run" ? "🏃" : "⚡"}
        </div>
      </div>

      {workout.structure && <p className="text-sm text-muted-foreground italic">{workout.structure}</p>}

      {shouldRecommend && (
        <div className="bg-secondary/40 rounded-lg p-3 text-sm space-y-1">
          <p className="font-semibold text-foreground">Readiness {readiness.score}/100</p>
          <p className="text-xs text-muted-foreground">{readiness.breakdown?.adjustment_reason || "Recovery session recommended"}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button className="flex-1">Start Session</Button>
        <Button variant="outline" className="flex-1">Log manually</Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">Strava will auto-sync when done</p>
    </div>
  );
}