/**
 * Workout Recommender — generates adjusted workout targets based on readiness
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

export function generateRecommendation({ workout, readiness, activities, profile, phase }) {
  const factor = getAdjustmentFactor(readiness.score ?? 70);

  const plannedDuration = workout.duration_minutes || 60;
  const plannedDistance = workout.distance_km || null;
  const plannedIntensity = workout.intensity || "moderate";
  const sport = workout.sport;

  // Phase overrides
  let adjustedFactor = factor;
  if (phase === "taper") adjustedFactor = Math.max(0.85, Math.min(0.9, factor));
  if (phase === "peak" && (readiness.score ?? 70) > 70) adjustedFactor = Math.min(1.05, factor * 1.05);

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
  if (readiness.score < 55) recIntensityIdx = Math.max(0, baseIntensityIdx - 1);
  if (readiness.score < 40) recIntensityIdx = 0;
  const recIntensity = INTENSITY_LEVELS[recIntensityIdx];
  const recHRZone = HR_ZONES[recIntensityIdx];

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
  };
}