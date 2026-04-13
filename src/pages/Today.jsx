import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Today() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [tomorrowWorkout, setTomorrowWorkout] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [weekWorkouts, setWeekWorkouts] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  async function loadData() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = moment().add(1, "day").format("YYYY-MM-DD");
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');

      const [twData, tmData, tomData, recData, weekData] = await Promise.all([
        base44.entities.PlannedWorkout.filter({ date: today, created_by: currentUser.email }),
        base44.entities.DailyMetrics.filter({ date: today, created_by: currentUser.email }),
        base44.entities.PlannedWorkout.filter({ date: tomorrow, created_by: currentUser.email }),
        base44.entities.PlanRecommendation.filter({
          workout_date: today,
          status: "pending",
          created_by: currentUser.email,
        }),
        base44.entities.PlannedWorkout.filter({ created_by: currentUser.email }),
      ]);

      setTodayWorkout(twData?.[0] || null);
      setTodayMetrics(tmData?.[0] || null);
      setTomorrowWorkout(tomData?.[0] || null);
      setRecommendations(recData || []);
      setWeekWorkouts(weekData || []);
    } catch (err) {
      toast.error("Could not load Today data");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveRec(rec) {
    try {
      if (rec.proposed_duration_minutes && todayWorkout) {
        await base44.entities.PlannedWorkout.update(todayWorkout.id, {
          duration_minutes: rec.proposed_duration_minutes,
          intensity: rec.proposed_intensity,
          description: rec.proposed_description,
        });
      }
      await base44.entities.PlanRecommendation.update(rec.id, { status: "approved" });
      toast.success("Recommendation approved");
      await loadData();
    } catch (err) {
      toast.error("Could not approve recommendation");
    }
  }

  async function handleDismissRec(rec) {
    try {
      await base44.entities.PlanRecommendation.update(rec.id, { status: "rejected" });
      toast.success("Recommendation dismissed");
      await loadData();
    } catch (err) {
      toast.error("Could not dismiss recommendation");
    }
  }

  async function markComplete() {
    if (!todayWorkout) return;
    try {
      await base44.entities.PlannedWorkout.update(todayWorkout.id, { status: "completed" });
      toast.success("Session marked complete");
      await loadData();
    } catch (err) {
      toast.error("Could not save");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Pending Recommendation */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border-2 border-accent bg-secondary/30 p-6 space-y-4">
          <Badge className="bg-accent/20 text-accent border-0">Coach Recommendation</Badge>
          <div className="grid grid-cols-2 gap-4">
            <div className="opacity-50">
              <p className="text-xs text-muted-foreground font-semibold">Original</p>
              <p className="text-lg line-through text-foreground">{todayWorkout?.duration_minutes}min</p>
              <p className="text-xs text-muted-foreground">{todayWorkout?.intensity}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Recommended</p>
              <p className="text-lg font-bold text-foreground">{recommendations[0].proposed_duration_minutes}min</p>
              <p className="text-xs text-accent font-semibold">{recommendations[0].proposed_intensity}</p>
            </div>
          </div>
          <p className="text-sm text-foreground">{recommendations[0].reason}</p>
          <div className="flex gap-3">
            <Button onClick={() => handleApproveRec(recommendations[0])} className="flex-1">
              Approve
            </Button>
            <Button onClick={() => handleDismissRec(recommendations[0])} variant="outline" className="flex-1">
              Keep Original
            </Button>
          </div>
        </div>
      )}

      {/* Today's Session */}
      {todayWorkout && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">{todayWorkout.title}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{todayWorkout.intensity}</Badge>
                <Badge variant="secondary">{todayWorkout.duration_minutes}min</Badge>
              </div>
            </div>
          </div>
          {todayWorkout.structure && <p className="text-sm text-muted-foreground italic">{todayWorkout.structure}</p>}
          <div className="flex gap-3">
            <Button className="flex-1" onClick={markComplete}>Mark Complete</Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/plan")}>
              Modify
            </Button>
          </div>
        </div>
      )}

      {!todayWorkout && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
          <p className="text-xl font-bold text-foreground">Rest Day</p>
          <p className="text-sm text-muted-foreground">Recovery is training.</p>
          <Button variant="outline" onClick={() => navigate("/recovery")}>View recovery tips</Button>
        </div>
      )}

      {/* Readiness Strip */}
      {todayMetrics && (
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Readiness</p>
            <p className="text-2xl font-bold text-foreground">{todayMetrics.readiness_score || "—"}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">HRV</p>
            <p className="text-lg font-bold text-foreground">{todayMetrics.hrv}ms</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Sleep</p>
            <p className="text-lg font-bold text-foreground">{todayMetrics.sleep_hours}h</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Form</p>
            <p className="text-lg font-bold text-foreground">{todayMetrics.tsb || "—"}</p>
          </div>
        </div>
      )}

      {/* Tomorrow Preview */}
      {tomorrowWorkout && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Tomorrow's Session</p>
          <p className="text-lg font-bold text-foreground">{tomorrowWorkout.title}</p>
          <div className="flex gap-2">
            <Badge variant="secondary">{tomorrowWorkout.intensity}</Badge>
            <Badge variant="secondary">{tomorrowWorkout.duration_minutes}min</Badge>
          </div>
        </div>
      )}

      {/* This Week */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <p className="text-sm font-semibold text-foreground">This Week</p>
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - d.getDay() + i);
            const dateStr = d.toISOString().split("T")[0];
            const w = weekWorkouts.find(w => w.date === dateStr);
            const isTdy = dateStr === today;
            return (
              <div
                key={i}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${isTdy ? "bg-primary/20 border border-primary" : "bg-secondary/30"}`}
              >
                <p className="font-semibold">{moment(d).format("ddd").charAt(0)}</p>
                <p>{d.getDate()}</p>
                {w ? <div className="h-2 w-2 rounded-full bg-accent" /> : <div className="h-2 w-2 rounded-full bg-secondary" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}