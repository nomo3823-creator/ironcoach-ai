import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RACE_TYPES, getRaceType, calculatePhases, formatPhases } from "@/lib/raceTypes";
import moment from "moment";

async function generatePlanInBatches({ raceDate, raceType, hoursPerWeek, level, profile, onProgress }) {
  const today       = moment();
  const raceMoment  = moment(raceDate);
  const totalWeeks  = Math.max(1, raceMoment.diff(today, "weeks"));
  const raceInfo    = getRaceType(raceType);
  const phases      = calculatePhases(totalWeeks, raceInfo.taperWeeks);
  const sports      = raceInfo.sports;

  // Build phase date ranges
  const phaseRanges = [];
  let cursor = today.clone().startOf("day");

  for (const [phase, weeks] of [["base", phases.base], ["build", phases.build], ["peak", phases.peak], ["taper", phases.taper]]) {
    if (weeks <= 0) continue;
    phaseRanges.push({
      phase,
      startDate: cursor.format("YYYY-MM-DD"),
      endDate:   cursor.clone().add(weeks * 7 - 1, "days").format("YYYY-MM-DD"),
      weeks,
    });
    cursor.add(weeks * 7, "days");
  }
  if (totalWeeks >= 1) {
    phaseRanges.push({
      phase:     "race_week",
      startDate: raceMoment.clone().subtract(6, "days").format("YYYY-MM-DD"),
      endDate:   raceDate,
      weeks:     1,
    });
  }

  const allWorkouts  = [];
  const phaseSummary = formatPhases(phases);

  for (let phIdx = 0; phIdx < phaseRanges.length; phIdx++) {
    const phaseInfo = phaseRanges[phIdx];
    onProgress?.({
      phase:   phaseInfo.phase,
      current: phIdx + 1,
      total:   phaseRanges.length,
      pct:     Math.round(((phIdx) / phaseRanges.length) * 90),
    });

    const phaseGuidance = {
      base:      "aerobic base-building — high volume, low intensity, technique focus",
      build:     "increasing intensity, sport-specific work, threshold development",
      peak:      "race-specific intensity, highest quality sessions, sharpen fitness",
      taper:     "dramatically reduced volume (40-60%), maintained intensity, race-prep",
      race_week: "minimal load — 2 short openers max, rest, race execution prep",
    }[phaseInfo.phase] || "balanced training";

    // Split long phases into ≤4-week batches
    let batchCursor = moment(phaseInfo.startDate);
    const phaseEnd  = moment(phaseInfo.endDate);

    while (batchCursor.isSameOrBefore(phaseEnd)) {
      const batchEnd   = moment.min(batchCursor.clone().add(27, "days"), phaseEnd);
      const batchWeeks = batchEnd.diff(batchCursor, "weeks") + 1;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert endurance coach generating a training plan.

ATHLETE:
- Experience: ${level}
- Weekly hours: ${hoursPerWeek}h
- FTP: ${profile?.current_ftp ? profile.current_ftp + "W" : "unknown"}
- Run threshold: ${profile?.threshold_run_pace || "5:00"}/km
- CSS: ${profile?.css_per_100m ? profile.css_per_100m + "s/100m" : "unknown"}
- Limiter: ${profile?.biggest_limiter || "general fitness"}

TARGET RACE: ${raceInfo.label} on ${raceDate}
FULL PLAN: ${phaseSummary} (${totalWeeks} weeks)
SPORTS: ${sports.join(", ")}

CURRENT BATCH:
- Phase: ${phaseInfo.phase.toUpperCase()} — ${phaseGuidance}
- Date range: ${batchCursor.format("YYYY-MM-DD")} to ${batchEnd.format("YYYY-MM-DD")} (${batchWeeks} weeks)

RULES:
- 80/20 polarized intensity (≥80% easy/zone2, ≤20% hard)
- Respect ${hoursPerWeek}h/week budget
- Only generate sessions for: ${sports.join(", ")}
- Every workout date MUST fall within ${batchCursor.format("YYYY-MM-DD")} and ${batchEnd.format("YYYY-MM-DD")}
- Do NOT include rest days as workout records
- Max ${batchWeeks * 6} workouts

Return workouts JSON array:`,
        response_json_schema: {
          type: "object",
          properties: {
            workouts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date:             { type: "string" },
                  sport:            { type: "string" },
                  title:            { type: "string" },
                  description:      { type: "string" },
                  duration_minutes: { type: "number" },
                  intensity:        { type: "string" },
                  structure:        { type: "string" },
                  target_hr_zone:   { type: "string" },
                  target_power:     { type: "number" },
                  phase:            { type: "string" },
                  week_number:      { type: "number" },
                  tss_estimate:     { type: "number" },
                },
              },
            },
          },
        },
      });

      allWorkouts.push(...(result?.workouts || []).map(w => ({
        ...w,
        phase:  phaseInfo.phase,
        status: "planned",
      })));

      batchCursor.add(28, "days");
    }
  }

  return allWorkouts;
}

export default function GeneratePlanModal({ onClose }) {
  const { currentUser } = useAuth();
  const [raceDate,      setRaceDate]      = useState("");
  const [raceType,      setRaceType]      = useState("140.6");
  const [hoursPerWeek,  setHoursPerWeek]  = useState("10");
  const [level,         setLevel]         = useState("intermediate");
  const [clearExisting, setClearExisting] = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [progress,      setProgress]      = useState(null); // { phase, current, total, pct }
  const [done,          setDone]          = useState(false);
  const [totalGenerated,setTotalGenerated]= useState(0);

  const selectedRaceInfo = getRaceType(raceType);
  const weeksToRace      = raceDate ? moment(raceDate).diff(moment(), "weeks") : 0;
  const phases           = raceDate ? calculatePhases(weeksToRace, selectedRaceInfo.taperWeeks) : null;

  async function generate(e) {
    e.preventDefault();
    setLoading(true);
    setDone(false);
    setProgress({ phase: "preparing", current: 0, total: 1, pct: 0 });

    const profile = (await base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1))?.[0];

    if (clearExisting) {
      setProgress(p => ({ ...p, phase: "clearing existing plan" }));
      const existing = await base44.entities.PlannedWorkout.filter({ created_by: currentUser.email }, "date", 1000);
      const toDelete = (existing || []).filter(w => w.status === "planned" || w.status === "modified");
      await Promise.all(toDelete.map(w => base44.entities.PlannedWorkout.delete(w.id)));
    }

    const workouts = await generatePlanInBatches({
      raceDate,
      raceType,
      hoursPerWeek: Number(hoursPerWeek),
      level,
      profile,
      onProgress: setProgress,
    });

    setProgress({ phase: "saving", current: progress?.total || 1, total: progress?.total || 1, pct: 95 });

    // Save in chunks of 50
    for (let i = 0; i < workouts.length; i += 50) {
      await base44.entities.PlannedWorkout.bulkCreate(workouts.slice(i, i + 50));
    }

    setTotalGenerated(workouts.length);
    setProgress({ phase: "done", current: 1, total: 1, pct: 100 });
    setLoading(false);
    setDone(true);
  }

  const phaseLabel = (p) => p?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Generate Training Plan</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} disabled={loading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {done ? (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-recovery" />
            <div>
              <p className="text-lg font-semibold text-foreground">Plan ready!</p>
              <p className="text-sm text-muted-foreground mt-1">{totalGenerated} sessions generated · {weeksToRace} weeks of training</p>
            </div>
            <Button onClick={onClose} className="w-full">View Plan →</Button>
          </div>
        ) : loading ? (
          <div className="py-8 flex flex-col items-center gap-5">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground capitalize">{phaseLabel(progress?.phase)}…</p>
              {progress?.total > 1 && (
                <p className="text-xs text-muted-foreground mt-1">Phase {progress.current} of {progress.total}</p>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress?.pct || 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Generating a complete periodized plan — this takes 30–90 seconds depending on length.
            </p>
          </div>
        ) : (
          <form onSubmit={generate} className="space-y-4">
            <div>
              <Label>Race / Event Type</Label>
              <Select value={raceType} onValueChange={setRaceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RACE_TYPES.map(rt => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRaceInfo.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedRaceInfo.description}</p>
              )}
            </div>

            <div>
              <Label>Race Date</Label>
              <Input
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
                required
                min={moment().add(4, "weeks").format("YYYY-MM-DD")}
              />
              {phases && raceDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  {weeksToRace} weeks · {formatPhases(phases)}
                </p>
              )}
            </div>

            <div>
              <Label>Available Hours / Week</Label>
              <Input
                type="number"
                value={hoursPerWeek}
                onChange={e => setHoursPerWeek(e.target.value)}
                min="3"
                max="25"
              />
            </div>

            <div>
              <Label>Experience Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner (first event of this type)</SelectItem>
                  <SelectItem value="intermediate">Intermediate (1–3 finishes)</SelectItem>
                  <SelectItem value="advanced">Advanced (4+ finishes)</SelectItem>
                  <SelectItem value="elite">Elite / Competitive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear existing toggle */}
            <div
              onClick={() => setClearExisting(!clearExisting)}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${clearExisting ? "text-accent" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Replace existing plan</p>
                <p className="text-xs text-muted-foreground">Delete current planned &amp; modified workouts first. Uncheck to append.</p>
              </div>
              <div className={`ml-auto h-4 w-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${clearExisting ? "bg-primary border-primary" : "border-border"}`}>
                {clearExisting && <span className="text-primary-foreground text-[10px] font-bold leading-none">✓</span>}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={!raceDate}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Complete Plan
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}