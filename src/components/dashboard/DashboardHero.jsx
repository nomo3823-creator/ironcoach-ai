import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import { toast } from "sonner";

export default function DashboardHero({ profile, race, readiness }) {
  const [syncTime, setSyncTime] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const last = profile?.last_strava_sync ? moment(profile.last_strava_sync).fromNow() : "never";
    setSyncTime(last);
  }, [profile]);

  async function handleSync() {
    setSyncing(true);
    try {
      await base44.functions.invoke("stravaSync", {});
      setSyncTime("just now");
      toast.success("Strava synced");
    } catch (err) {
      toast.error("Sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  }

  const getPhaseLabel = () => {
    const phaseMap = {
      base: "Base Phase",
      build: "Build Phase",
      peak: "Peak Phase",
      taper: "Taper Phase",
      race_week: "Race Week",
    };
    return phaseMap[profile?.current_training_phase] || "Training";
  };

  const getRaceDays = () => {
    if (!race) return null;
    const days = Math.ceil((new Date(race.date) - new Date()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const todayDate = moment().format("dddd, MMM D");
  const firstName = profile?.first_name || "Athlete";
  
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-2xl border border-border p-6 space-y-4">
      {/* Greeting & Date */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{getGreeting()}, {firstName}.</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todayDate} · {getPhaseLabel()}
        </p>
      </div>

      {/* Race countdown + Sync status */}
      <div className="flex items-center justify-between">
        <div>
          {race && getRaceDays() !== null ? (
            <p className="text-sm text-accent font-semibold">
              {getRaceDays()} days to {race.name}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming races</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Strava synced {syncTime || "..."}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}