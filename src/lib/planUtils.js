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
 * Downgrade a workout to easy/recovery and log the change
 */
export async function downgradeWorkout(workout, reason, changeType, signalValue) {
  const before = {
    title: workout.title,
    duration_minutes: workout.duration_minutes,
    intensity: workout.intensity,
  };

  const newDuration = Math.round((workout.duration_minutes || 60) * 0.6);
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

  const last14 = historicalMetrics
    .filter((m) => m.hrv > 0)
    .slice(-14)
    .map((m) => m.hrv);

  if (last14.length < 3) return { shouldDowngrade: false };

  const avg = last14.reduce((s, v) => s + v, 0) / last14.length;
  const dropPct = ((avg - todayMetrics.hrv) / avg) * 100;

  return {
    shouldDowngrade: dropPct >= 10,
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