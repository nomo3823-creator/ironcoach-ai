import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatDistance } from "@/lib/unitConversions";
import moment from "moment";

export default function StravaActivityFeed({ activities }) {
  const recent = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const totalMonth = activities.filter(a => {
    const d = new Date(a.date);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return d >= monthAgo;
  }).length;

  if (!recent.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <p>No activities yet. Sync Strava to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Recent Activities</h3>

      <div className="space-y-3">
        {recent.map(a => (
          <div key={a.id} className="border-l-4 border-l-bike pl-4 pb-3 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{moment(a.date).fromNow()}</p>
              </div>
              {a.tss > 0 && (
                <Badge
                  className={`text-xs border-0 ${
                    a.tss < 50 ? "bg-recovery/20 text-recovery" : a.tss < 100 ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {a.tss} TSS
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {a.distance_km ? formatDistance(a.distance_km) : ""} {a.distance_km && a.duration_minutes ? "·" : ""} {a.duration_minutes}min {a.avg_hr > 0 ? `· ${a.avg_hr}bpm` : ""}
            </p>
            {a.aerobic_decoupling > 5 && <p className="text-xs text-destructive mt-1">⚠ High aerobic decoupling</p>}
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 text-xs text-muted-foreground">
        <p>Strava: {totalMonth} activities this month</p>
      </div>

      <Link to="/analytics">
        <Button variant="outline" className="w-full text-xs">View all activities</Button>
      </Link>
    </div>
  );
}