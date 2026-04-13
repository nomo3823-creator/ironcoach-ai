import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sportColors, sportIcons, formatDuration } from "@/lib/sportUtils";
import { Check, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const intensityLabel = { easy: "Easy", moderate: "Moderate", hard: "Hard", race_pace: "Race Pace", recovery: "Recovery" };

export default function TodayWorkoutCard({ workout, onRefresh, pendingRec }) {
  const [approving, setApproving] = useState(false);

  async function approvePendingRec() {
    setApproving(true);
    await base44.entities.PlannedWorkout.update(pendingRec.workout_id, {
      duration_minutes: pendingRec.proposed_duration_minutes,
      intensity: pendingRec.proposed_intensity,
      description: pendingRec.proposed_description || workout?.description,
      ai_adjustment_reason: pendingRec.reason,
      status: "planned"
    });
    await base44.entities.PlanRecommendation.update(pendingRec.id, { status: "approved" });
    setApproving(false);
    onRefresh?.();
  }

  async function dismissPendingRec() {
    await base44.entities.PlanRecommendation.update(pendingRec.id, { status: "rejected" });
    onRefresh?.();
  }
  if (!workout) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">😴</span>
          <div>
            <h3 className="font-semibold text-foreground">Rest Day</h3>
            <p className="text-sm text-muted-foreground">Recovery is training. Relax and refuel.</p>
          </div>
        </div>
      </div>
    );
  }

  const c = sportColors[workout.sport] || sportColors.other;

  async function mark(status) {
    await base44.entities.PlannedWorkout.update(workout.id, { status });
    onRefresh?.();
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden" style={{ borderColor: c.hex + "50" }}>
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${c.hex}, transparent)` }} />
      <div className="p-5">
        {pendingRec && (
          <div className="mb-5 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-amber-500">Coach Recommendation</p>
              <p className="text-sm text-foreground mt-1">{pendingRec.reason}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded bg-secondary/30">
                <p className="text-muted-foreground font-medium mb-1">Original</p>
                <p className="text-foreground font-semibold">{pendingRec.original_duration_minutes}min · {pendingRec.original_intensity}</p>
              </div>
              <div className="p-2 rounded bg-secondary/30">
                <p className="text-muted-foreground font-medium mb-1">Recommended</p>
                <p className="text-foreground font-semibold">{pendingRec.proposed_duration_minutes}min · {pendingRec.proposed_intensity}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white flex-1" onClick={approvePendingRec} disabled={approving}>
                {approving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                Approve
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={dismissPendingRec}>Dismiss</Button>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{sportIcons[workout.sport] || "⚡"}</div>
            <div>
              <h3 className="font-semibold text-foreground">{workout.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-medium" style={{ color: c.hex }}>
                  {workout.sport}
                </span>
                <span className="text-xs text-muted-foreground">{formatDuration(workout.duration_minutes)}</span>
                {workout.intensity && <span className="text-xs text-muted-foreground">· {intensityLabel[workout.intensity]}</span>}
              </div>
            </div>
          </div>
          {workout.status === "completed" && (
            <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-recovery/10 text-recovery flex items-center gap-1">
              <Check className="h-3 w-3" /> Done
            </span>
          )}
        </div>

        {workout.description && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{workout.description}</p>
        )}

        {workout.structure && (
          <pre className="mt-3 p-3 rounded-lg bg-secondary/50 text-xs text-secondary-foreground font-mono whitespace-pre-wrap">
            {workout.structure}
          </pre>
        )}

        <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
          {workout.target_hr_zone && <span>HR: <span className="text-foreground font-medium">{workout.target_hr_zone}</span></span>}
          {workout.target_pace && <span>Pace: <span className="text-foreground font-medium">{workout.target_pace}</span></span>}
          {workout.target_power > 0 && <span>Power: <span className="text-foreground font-medium">{workout.target_power}W</span></span>}
          {workout.tss_estimate > 0 && <span>TSS: <span className="text-foreground font-medium">{workout.tss_estimate}</span></span>}
        </div>

        {workout.ai_adjustment_reason && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{workout.ai_adjustment_reason}</span>
          </div>
        )}

        {workout.status === "planned" && (
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-recovery hover:bg-recovery/90 text-white" onClick={() => mark("completed")}>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Mark Complete
            </Button>
            <Button size="sm" variant="outline" onClick={() => mark("modified")}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Modify
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}