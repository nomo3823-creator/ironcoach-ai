import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { sportColors, sportIcons, formatDuration } from "@/lib/sportUtils";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

export default function RecentActivities({ activities = [], onRefresh }) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("stravaSync", {});
      toast("Sync complete", { description: `${res.data?.synced || 0} new activities imported` });
      if (onRefresh) onRefresh();
    } catch (err) {
      toast("Sync failed", { description: err.message, variant: "destructive" });
    }
    setSyncing(false);
  }

  if (!activities.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activities</h3>
        <p className="text-sm text-muted-foreground">No activities yet. Connect your devices to start importing workouts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Recent Activities</h3>
        <Button size="sm" variant="ghost" onClick={handleSync} disabled={syncing} className="gap-1.5 text-xs h-7">
          {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {syncing ? "Syncing..." : "Sync"}
        </Button>
      </div>
      <div className="space-y-2">
        {activities.slice(0, 6).map((a) => {
          const c = sportColors[a.sport] || sportColors.other;
          return (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: c.hex + "15" }}>
                {sportIcons[a.sport] || "⚡"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{moment(a.date).fromNow()}</span>
                  <span>·</span>
                  <span>{formatDuration(a.duration_minutes)}</span>
                  {a.distance_km > 0 && <><span>·</span><span>{a.distance_km.toFixed(1)}km</span></>}
                </div>
              </div>
              <div className="text-right shrink-0">
                {a.tss > 0 && <p className="text-sm font-semibold text-foreground">{a.tss} <span className="text-xs font-normal text-muted-foreground">TSS</span></p>}
                {a.avg_hr > 0 && <p className="text-xs text-muted-foreground">{a.avg_hr}bpm</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}