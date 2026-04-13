/**
 * Workout Recommender — generates adjusted workout targets based on readiness and Apple Health signals
 */
import { getAdjustmentFactor } from "./readinessEngine.js";

const INTENSITY_LEVELS = ["easy", "moderate", "hard", "race_pace"];
const HR_ZONES = ["Zone 1-2", "Zone 2-3", "Zone 3-4", "Zone 4-5"];
const INTENSITY_ZONE_MAP = { easy: 0, moderate: 1, hard: 2, race_pace: 3 };

function paceToSecs(paceStr) {
  if (!paceStr) return null;
  const str = String(paceStr).trim();
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return m * 60 + (s || 0);
  }
  return parseFloat(str) * 60;
}

function secsToMinKm(s) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function generateRecommendation({ workout, readiness, activities, profile, metrics = [], phase }) {
  let factor = getAdjustmentFactor(readiness.score ?? 70);

  const plannedDuration = workout.duration_minutes || 60;
  const plannedDistance = workout.distance_km || null;
  const plannedIntensity = workout.intensity || "moderate";
  const sport = workout.sport;

  // Apple Watch signals: apply additional fatigue reduction
  const today = metrics?.length > 0 ? metrics.sort((a, b) => b.date > a.date ? 1 : -1)[0] : null;
  
  // If overnight HRV is >15% below baseline, apply 15% additional reduction
  if (readiness.breakdown?.apple_watch_hrv_alert) {
    factor *= 0.85;
  }

  // If sleep was poor, cap intensity at "moderate" regardless of readiness
  let forceLowIntensity = false;
  if (readiness.breakdown?.poor_sleep_alert) {
    forceLowIntensity = true;
    factor *= 0.8;
  }

  // If SpO2 was below 94% overnight, flag as potential illness
  if (today?.spo2 && today.spo2 < 94) {
    forceLowIntensity = true;
    factor *= 0.7;
  }

  // If resting HR is 5+ bpm above baseline, apply additional reduction
  if (readiness.breakdown?.rhr_today && readiness.breakdown?.rhr_baseline) {
    const hrDiff = readiness.breakdown.rhr_today - readiness.breakdown.rhr_baseline;
    if (hrDiff >= 5) {
      factor *= (1 - (hrDiff * 0.02)); // 2% reduction per bpm above baseline
    }
  }

  // Phase overrides
  let adjustedFactor = factor;
  if (phase === "taper") adjustedFactor = Math.max(0.85, Math.min(0.9, factor));
  if (phase === "peak" && (readiness.score ?? 70) > 70) adjustedFactor = Math.min(1.05, factor * 1.05);
  if (forceLowIntensity) adjustedFactor = Math.min(adjustedFactor, 0.75);

  // Sport-specific fatigue: same sport yesterday at TSS > 70
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];
  const sameSportYesterday = activities.filter(a => a.date === yStr && a.sport === sport);
  const yTSS = sameSportYesterday.reduce((s, a) => s + (a.training_stress_score || a.tss || 0), 0);
  if (yTSS > 70) adjustedFactor *= 0.9;

  const recDuration = Math.round((plannedDuration * adjustedFactor) / 5) * 5;
  const recDistance = plannedDistance ? Math.round(plannedDistance * adjustedFactor * 10) / 10 : null;

  // Intensity adjustment
  const baseIntensityIdx = INTENSITY_ZONE_MAP[plannedIntensity] ?? 1;
  let recIntensityIdx = baseIntensityIdx;
  if (forceLowIntensity) {
    recIntensityIdx = 0; // Force easy if poor sleep/low SpO2
  } else if (readiness.score < 55) {
    recIntensityIdx = Math.max(0, baseIntensityIdx - 1);
  } else if (readiness.score < 40) {
    recIntensityIdx = 0;
  }
  const recIntensity = INTENSITY_LEVELS[recIntensityIdx];
  const recHRZone = HR_ZONES[recIntensityIdx];

  // Track adjustment reason for coach notes
  let adjustmentReason = null;
  if (readiness.breakdown?.apple_watch_hrv_alert) {
    adjustmentReason = 'HRV drop detected — extra recovery recommended';
  } else if (readiness.breakdown?.poor_sleep_alert) {
    adjustmentReason = 'Poor sleep quality detected — intensity capped at easy';
  } else if (today?.spo2 && today.spo2 < 94) {
    adjustmentReason = 'Low SpO2 detected — easy effort only';
  }

  // Power (cycling)
  let recPower = null;
  const ftp = profile?.current_ftp;
  if (sport === "bike" && ftp) {
    const pctMap = { easy: 0.65, moderate: 0.78, hard: 0.88, race_pace: 0.95 };
    recPower = Math.round(ftp * (pctMap[recIntensity] || 0.75));
  }

  // Pace (running)
  let recPace = null;
  const threshSecs = paceToSecs(profile?.threshold_run_pace);
  if (sport === "run" && threshSecs) {
    const paceFactorMap = { easy: 1.25, moderate: 1.10, hard: 1.02, race_pace: 1.0 };
    const recPaceSecs = threshSecs * (paceFactorMap[recIntensity] || 1.1);
    recPace = secsToMinKm(recPaceSecs);
  }

  // TSS target
  const tssPerMinMap = { easy: 0.6, moderate: 0.9, hard: 1.3, race_pace: 1.5 };
  const recTSS = Math.round(recDuration * (tssPerMinMap[recIntensity] || 0.9));

  // Structure note
  const structureMap = {
    easy: `${recDuration}min conversational pace — stay in ${recHRZone} the entire session.`,
    moderate: `${recDuration}min steady effort — ${recHRZone} throughout with controlled breathing.`,
    hard: `${recDuration}min — warm up 15min, main set ${recDuration - 20}min at ${recHRZone}, cool down 5min.`,
    race_pace: `${recDuration}min race-pace simulation — maintain target splits throughout.`,
  };
  const recStructure = structureMap[recIntensity];

  const changed = Math.abs(recDuration - plannedDuration) / plannedDuration > 0.08 ||
    recIntensity !== plannedIntensity;

  return {
    recommended_duration_minutes: recDuration,
    recommended_distance_km: recDistance,
    recommended_intensity: recIntensity,
    recommended_hr_zone: recHRZone,
    recommended_target_power: recPower,
    recommended_target_pace: recPace,
    recommended_tss_target: recTSS,
    recommended_structure: recStructure,
    adjustment_factor: adjustedFactor,
    requires_approval: changed,
    planned_duration: plannedDuration,
    planned_intensity: plannedIntensity,
    readiness_score: readiness.score,
    readiness_label: readiness.label,
    adjustment_reason: adjustmentReason,
  };
}