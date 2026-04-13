import { base44 } from "@/api/base44Client";

/**
 * Log a plan change to the PlanChangeLog entity
 */
export async function logPlanChange({
  workoutId,
  changeType,
  summary,
  reason,
  workoutDate,
  signalValue,
  before = {},
  after = {},
}) {
  await base44.entities.PlanChangeLog.create({
    workout_id: workoutId,
    change_type: changeType,
    change_summary: summary,
    reason,
    workout_date: workoutDate,
    signal_value: signalValue,
    before_title: before.title,
    before_duration: before.duration_minutes,
    before_intensity: before.intensity,
    after_title: after.title,
    after_duration: after.duration_minutes,
    after_intensity: after.intensity,
  });
}

/**
 * Calculate fitness metrics (CTL, ATL, TSB) from activities using Coggan PMC model
 */
export function calculateFitnessMetrics(activities) {
  if (!activities?.length) return { ctl: 0, atl: 0, tsb: 0, dailyTSS: {}, history: {} };
  
  const sorted = [...activities].sort((a, b) => a.date > b.date ? 1 : -1);
  const today = new Date().toISOString().split("T")[0];
  
  // Build daily TSS map
  const dailyTSS = {};
  sorted.forEach(act => {
    const tss = act.training_stress_score || act.tss_calculated || act.tss || 0;
    dailyTSS[act.date] = (dailyTSS[act.date] || 0) + tss;
  });
  
  // CTL = 42-day exponentially weighted average (fitness)
  // ATL = 7-day exponentially weighted average (fatigue)
  const ctlDecay = 1 - Math.exp(-1 / 42);
  const atlDecay = 1 - Math.exp(-1 / 7);
  
  let ctl = 0, atl = 0;
  const earliest = sorted[0]?.date || today;
  const history = {};
  
  let current = new Date(earliest);
  const end = new Date(today);
  
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const tss = dailyTSS[dateStr] || 0;
    ctl = ctl + (tss - ctl) * ctlDecay;
    atl = atl + (tss - atl) * atlDecay;
    history[dateStr] = {
      ctl: parseFloat(ctl.toFixed(1)),
      atl: parseFloat(atl.toFixed(1)),
      tsb: parseFloat((ctl - atl).toFixed(1)),
      tss,
    };
    current.setDate(current.getDate() + 1);
  }
  
  const todayMetrics = history[today] || { ctl: 0, atl: 0, tsb: 0 };
  return {
    ctl: todayMetrics.ctl,
    atl: todayMetrics.atl,
    tsb: todayMetrics.tsb,
    history,
    dailyTSS,
  };
}

/**
 * Get TSS from an activity record, handling multiple field name conventions
 */
export function getActivityTSS(activity) {
  return activity?.training_stress_score || activity?.tss_calculated || activity?.tss || activity?.suffer_score ? Math.round((activity.suffer_score || 0) * 1.0) : 0;
}

/**
 * Downgrade a workout to easy/recovery and log the change
 */
export async function downgradeWorkout(workout, reason, changeType, signalValue, severity = "moderate") {
  const before = {
    title: workout.title,
    duration_minutes: workout.duration_minutes,
    intensity: workout.intensity,
  };

  const reductionFactor = severity === "severe" ? 0.5 : severity === "moderate" ? 0.7 : 0.85;
  const newDuration = Math.round((workout.duration_minutes || 60) * reductionFactor);
  const newTitle = `[Recovery] ${workout.title}`;

  await base44.entities.PlannedWorkout.update(workout.id, {
    title: newTitle,
    intensity: "easy",
    duration_minutes: newDuration,
    ai_adjustment_reason: reason,
    status: "modified",
  });

  await logPlanChange({
    workoutId: workout.id,
    changeType,
    summary: `Downgraded "${workout.title}" to recovery session`,
    reason,
    workoutDate: workout.date,
    signalValue,
    before,
    after: { title: newTitle, duration_minutes: newDuration, intensity: "easy" },
  });
}

/**
 * Check HRV drop against 14-day rolling average and return the drop percentage
 * Returns { shouldDowngrade: bool, dropPct: number, rollingAvg: number }
 */
export function checkHrvDrop(todayMetrics, historicalMetrics) {
  if (!todayMetrics?.hrv || !historicalMetrics?.length) return { shouldDowngrade: false };

  const todayStr = new Date().toISOString().split("T")[0];
  const last14 = historicalMetrics
    .filter((m) => m.hrv > 0 && m.date <= todayStr)
    .slice(-14)
    .map((m) => m.hrv);

  if (last14.length < 3) return { shouldDowngrade: false };

  const avg = last14.reduce((s, v) => s + v, 0) / last14.length;
  const dropPct = ((avg - todayMetrics.hrv) / avg) * 100;

  return {
    shouldDowngrade: dropPct >= 8,
    dropPct: Math.round(dropPct),
    rollingAvg: Math.round(avg),
  };
}

/**
 * Check for 3+ consecutive nights of poor sleep
 */
export function checkPoorSleepStreak(metrics) {
  const sorted = [...(metrics || [])].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const m of sorted.slice(0, 5)) {
    if (m.sleep_quality === "poor" || m.sleep_quality === "fair") streak++;
    else break;
  }
  return streak;
}