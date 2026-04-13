import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, X, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { calculateReadiness } from "@/lib/readinessEngine";
import { generateRecommendation } from "@/lib/workoutRecommender";
import moment from "moment";

export default function DailyRecommendationWidget({ sport, activities, metrics }) {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [rec, setRec] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [coachNote, setCoachNote] = useState("");
  const [loadingNote, setLoadingNote] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    async function load() {
      const [p, workouts] = await Promise.all([
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1),
        base44.entities.PlannedWorkout.filter({ created_by: currentUser.email }, "date", 30),
      ]);
      const prof = p?.[0];
      setProfile(prof);
      const today = moment().format("YYYY-MM-DD");
      const upcoming = workouts?.find(w => w.date >= today && w.sport === sport && w.status === "planned");
      setTodayWorkout(upcoming || null);

      if (upcoming) {
        const readiness = calculateReadiness(metrics, activities);
        const recommendation = generateRecommendation({
          workout: upcoming,
          readiness,
          activities,
          profile: prof,
          phase: upcoming.phase,
        });
        setRec(recommendation);
      }
    }
    load();
  }, [sport]);

  async function handleApprove() {
    if (!todayWorkout || !rec) return;
    setApproving(true);
    if (rec.requires_approval) {
      await base44.entities.PlanRecommendation.create({
        workout_id: todayWorkout.id,
        workout_date: todayWorkout.date,
        workout_title: todayWorkout.title,
        sport: todayWorkout.sport,
        recommendation_type: "modify",
        original_duration_minutes: rec.planned_duration,
        proposed_duration_minutes: rec.recommended_duration_minutes,
        original_intensity: rec.planned_intensity,
        proposed_intensity: rec.recommended_intensity,
        reason: `Readiness ${rec.readiness_score}/100 (${rec.readiness_label}). ${coachNote || rec.recommended_structure}`,
        triggered_by: "daily_metrics",
        status: "approved",
      });
      await base44.entities.PlannedWorkout.update(todayWorkout.id, {
        duration_minutes: rec.recommended_duration_minutes,
        intensity: rec.recommended_intensity,
        target_power: rec.recommended_target_power || undefined,
        target_pace: rec.recommended_target_pace || undefined,
        ai_adjustment_reason: `Readiness ${rec.readiness_score}/100 — ${rec.readiness_label}`,
      });
    }
    setApproved(true);
    setApproving(false);
  }

  async function getCoachNote() {
    if (!rec || !todayWorkout) return;
    setLoadingNote(true);
    const note = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a direct endurance coach texting your athlete. Write 2 sentences max (under 50 words total). No bullet points.
Today's session: ${todayWorkout.sport} — ${rec.recommended_duration_minutes}min, ${rec.recommended_intensity} intensity
${rec.recommended_target_pace ? `Target pace: ${rec.recommended_target_pace}/km` : ""}${rec.recommended_target_power ? `Target power: ${rec.recommended_target_power}W` : ""}
Readiness: ${rec.readiness_score}/100 (${rec.readiness_label})
Athlete limiter: ${profile?.biggest_limiter || "unknown"}
Tell them what to do, why (reference readiness), and one execution cue based on their limiter. Sound like a coach text, not a report.`
    });
    setCoachNote(note);
    setLoadingNote(false);
  }

  if (dismissed || !todayWorkout || !rec) return null;

  const durationDiff = rec.recommended_duration_minutes - rec.planned_duration;
  const isReduced = durationDiff < -2;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/15 flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Today's AI Recommendation</p>
            <p className="text-[11px] text-muted-foreground">{todayWorkout.title}</p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Recommendation summary */}
      <div className="rounded-lg bg-secondary/60 p-3 space-y-1">
        <p className="text-sm font-medium text-foreground">
          {rec.recommended_intensity.charAt(0).toUpperCase() + rec.recommended_intensity.slice(1)} {todayWorkout.sport} — {rec.recommended_duration_minutes}min
          {isReduced && <span className="text-xs text-muted-foreground ml-1">(adjusted from {rec.planned_duration}min)</span>}
          {rec.recommended_target_pace && <> · {rec.recommended_target_pace}/km</>}
          {rec.recommended_target_power && <> · {rec.recommended_target_power}W</>}
          {' · '}{rec.recommended_hr_zone}
          {' · '}TSS ~{rec.recommended_tss_target}
        </p>
        <p className="text-xs text-muted-foreground">
          Readiness {rec.readiness_score}/100 — {rec.readiness_label.toLowerCase()}
          {rec.adjustment_factor < 1 ? ` · session reduced to ${Math.round(rec.adjustment_factor * 100)}% of plan` : ""}
        </p>
      </div>

      {/* Coach note */}
      {coachNote ? (
        <p className="text-xs text-foreground/80 italic leading-relaxed">{coachNote}</p>
      ) : (
        <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={getCoachNote} disabled={loadingNote}>
          {loadingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 text-primary" />}
          Get coaching note
        </Button>
      )}

      {/* Expand breakdown */}
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground w-full">
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Why? — readiness breakdown
      </button>

      {expanded && (
        <div className="rounded-lg bg-secondary/40 p-3 space-y-1 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ["HRV signal", rec.recommended_tss_target, "pts"],
              ["Sleep", null, null],
              ["Body Battery", null, null],
              ["Form (TSB)", null, null],
              ["Yesterday load", null, null],
            ].filter(() => true).map(([k]) => null)}
          </div>
          <p>Adjustment factor: <span className="text-foreground font-medium">{Math.round(rec.adjustment_factor * 100)}%</span></p>
          <p>Structure: <span className="text-foreground">{rec.recommended_structure}</span></p>
        </div>
      )}

      {/* Action buttons */}
      {!approved ? (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs gap-1.5 h-8" onClick={handleApprove} disabled={approving}>
            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Apply to plan
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-recovery">
          <CheckCircle2 className="h-4 w-4" /> Applied to training plan
        </div>
      )}
    </div>
  );
}