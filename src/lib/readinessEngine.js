/**
 * Readiness Engine — calculates a composite 0-100 readiness score
 * from DailyMetrics and recent Activities, with Apple Health integration.
 */
import { calculateFitnessMetrics } from "@/lib/planUtils";

export const READINESS_BANDS = [
  { min: 85, max: 100, label: "Excellent", color: "#14b8a6", description: "Body primed for peak effort. Execute hard sessions as planned." },
  { min: 70, max: 84,  label: "Good",      color: "#0ea5e9", description: "Well recovered. Train as planned with full confidence." },
  { min: 55, max: 69,  label: "Moderate",  color: "#f59e0b", description: "Some fatigue present. Reduce intensity 10-15%, keep duration." },
  { min: 40, max: 54,  label: "Low",       color: "#f97316", description: "Meaningful fatigue. Easy sessions only. Prioritize sleep tonight." },
  { min: 20, max: 39,  label: "Very Low",  color: "#ef4444", description: "Significant accumulated fatigue. Rest or very easy movement only." },
  { min: 0,  max: 19,  label: "Rest",      color: "#dc2626", description: "Body is signaling stop. Mandatory rest. Any training will impair recovery." },
];

export function getBand(score) {
  return READINESS_BANDS.find(b => score >= b.min && score <= b.max) || READINESS_BANDS[5];
}

export function calculateReadiness(metrics = [], activities = []) {
  const sorted = [...metrics].sort((a, b) => b.date > a.date ? 1 : -1);
  // Today's raw row (may be the morning-checkin row with null Apple Health fields).
  const rawToday = sorted[0];
  // Fallback: most recent row that actually has Apple Health values. When
  // today's row is the morning check-in only, this lets the engine see
  // yesterday's HRV / sleep / RHR instead of declaring "no data".
  const mostRecentWithData = sorted.find(m =>
    (m.hrv && m.hrv > 0) ||
    (m.sleep_hours && m.sleep_hours > 0) ||
    (m.body_battery && m.body_battery > 0) ||
    (m.resting_hr && m.resting_hr > 0) ||
    (m.spo2 && m.spo2 > 0)
  );
  // Merge: prefer today's own values where present, otherwise fall back.
  const today = rawToday && mostRecentWithData && rawToday !== mostRecentWithData
    ? {
        ...mostRecentWithData,
        ...Object.fromEntries(Object.entries(rawToday).filter(([, v]) => v !== null && v !== undefined)),
      }
    : (rawToday || mostRecentWithData || null);

  const breakdown = {
    hrv: 0, sleep_hours: 0, sleep_quality: 0, body_battery: 0, resting_hr: 0,
    tsb: 0, rest_days: 0, yesterday_tss: 0, spo2_penalty: 0, vo2_max: 0,
  };

  // VO2 Max (display-only signal from Apple Health)
  if (today?.vo2_max && today.vo2_max > 0) {
    breakdown.vo2_max = today.vo2_max;
  }

  // ── RECOVERY SIGNALS (50pts) ──────────────────────────────────────────────

  // HRV (15 pts) — 7-day rolling mean vs 14-day baseline (more robust)
  const todayStr = today?.date || new Date().toLocaleDateString('en-CA');
  const last14 = sorted.filter(m => m.hrv && m.hrv > 0 && m.date <= todayStr).slice(-14);
  const last7hrv = sorted.filter(m => m.hrv && m.hrv > 0 && m.date <= todayStr).slice(-7);
  const todayHRV = today?.hrv && today.hrv > 0 ? today.hrv : null;
  
  if (last14.length >= 3 && last7hrv.length >= 2) {
    const baseline14 = last14.reduce((s, m) => s + m.hrv, 0) / last14.length;
    const rolling7mean = last7hrv.reduce((s, m) => s + m.hrv, 0) / last7hrv.length;
    const ratio = rolling7mean / baseline14;
    breakdown.hrv = ratio >= 1.02 ? 15 : ratio >= 0.97 ? 12 : ratio >= 0.92 ? 8 : ratio >= 0.85 ? 4 : 0;
    breakdown.hrv_baseline = Math.round(baseline14);
    breakdown.hrv_today = todayHRV || 0;
    breakdown.hrv_ratio = Math.round((ratio - 1) * 100);
    // Flag if 7-day mean is more than 8% below baseline (research threshold)
    if (ratio < 0.92) breakdown.apple_watch_hrv_alert = true;
  } else if (todayHRV) {
    breakdown.hrv = 10;
  }

  // Sleep hours (10 pts)
  const todaySleep = today?.sleep_hours && today.sleep_hours > 0 ? today.sleep_hours : null;
  if (todaySleep) {
    const h = todaySleep;
    breakdown.sleep_hours = h >= 8 ? 10 : h >= 7 ? 8 : h >= 6 ? 5 : 0;
    breakdown.sleep_hours_value = h;
  }

  // Sleep quality (10 pts) — Apple Health sleep analysis
  const sqMap = { excellent: 10, good: 8, fair: 4, poor: 0 };
  breakdown.sleep_quality = sqMap[today?.sleep_quality] ?? 0;
  breakdown.sleep_quality_value = today?.sleep_quality || null;

  // If sleep was poor, additional fatigue signal
  if (today?.sleep_quality === 'poor' || (todaySleep && todaySleep < 6)) {
    breakdown.poor_sleep_alert = true;
  }

  // Body battery (10 pts)
  const todayBB = today?.body_battery && today.body_battery > 0 ? today.body_battery : null;
  if (todayBB) {
    const bb = todayBB;
    breakdown.body_battery = bb >= 80 ? 10 : bb >= 60 ? 8 : bb >= 40 ? 5 : 0;
    breakdown.body_battery_value = bb;
  }

  // Resting HR (5 pts) — Apple Health resting HR
  const restHRs = sorted.slice(0, 14).filter(m => m.resting_hr && m.resting_hr > 0);
  const todayRHR = today?.resting_hr && today.resting_hr > 0 ? today.resting_hr : null;
  if (todayRHR && restHRs.length >= 3) {
    const baseline = restHRs.slice(1).reduce((s, m) => s + m.resting_hr, 0) / (restHRs.length - 1);
    const diff = todayRHR - baseline;
    breakdown.resting_hr = diff <= 0 ? 5 : diff <= 5 ? 3 : 0;
    breakdown.rhr_baseline = Math.round(baseline);
    breakdown.rhr_today = todayRHR;
  }

  // SpO2 signal (additional recovery metric from Apple Health)
  const todaySpO2 = today?.spo2 && today.spo2 > 0 ? today.spo2 : null;
  if (todaySpO2 && todaySpO2 < 94) {
    breakdown.low_spo2_alert = true;
    breakdown.spo2_penalty = todaySpO2 < 93 ? 10 : 5;
    breakdown.low_spo2_value = todaySpO2;
  }

  // ── TRAINING LOAD SIGNALS (50pts) ─────────────────────────────────────────

  // TSB (20 pts) — research-based thresholds (Mujika & Padilla 2003, Coggan PMC).
  // Prefer today's stored TSB if set; otherwise compute from the activities
  // array (the DailyMetrics ctl/atl/tsb columns are almost always null after
  // an Apple Health-only import).
  let tsb = today?.tsb ?? null;
  if (tsb === null && activities?.length > 0) {
    const fitness = calculateFitnessMetrics(activities);
    if (fitness && typeof fitness.tsb === "number") tsb = fitness.tsb;
  }
  if (tsb !== null) {
    // Optimal racing: -10 to +5 TSB
    breakdown.tsb = tsb >= -10 && tsb <= 5 ? 20    // optimal performance zone
                 : tsb > 5 && tsb <= 15 ? 17        // fresh but slightly detrained
                 : tsb > 15 ? 13                     // too fresh = detraining
                 : tsb >= -20 ? 10                   // normal training fatigue
                 : tsb >= -30 ? 4                    // high fatigue
                 : 0;                                // overreached
    breakdown.tsb_value = tsb;
    breakdown.tsb_interpretation = tsb >= -10 && tsb <= 5 ? "Optimal performance zone"
      : tsb > 5 ? "Fresh — maintain fitness with quality sessions"
      : tsb >= -20 ? "Normal training fatigue — body is adapting"
      : tsb >= -30 ? "High fatigue — monitor recovery closely"
      : "Overreached — reduce load immediately";
  }

  // Days since last rest day (15 pts)
  const actSorted = [...activities].sort((a, b) => b.date > a.date ? 1 : -1);
  let consecDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayStr);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (actSorted.some(a => a.date === ds)) consecDays++;
    else break;
  }
  breakdown.rest_days = consecDays <= 2 ? 15 : consecDays === 3 ? 10 : consecDays === 4 ? 5 : 0;
  breakdown.consecutive_days = consecDays;

  // Yesterday's TSS (15 pts)
  const yesterday = new Date(todayStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  const yesterdayActs = actSorted.filter(a => a.date === yStr);
  const yTSS = yesterdayActs.reduce((s, a) => s + (a.training_stress_score || a.tss || 0), 0);
  breakdown.yesterday_tss = yTSS < 50 ? 15 : yTSS <= 80 ? 10 : yTSS <= 120 ? 5 : 0;
  breakdown.yesterday_tss_value = yTSS;

  const score = Math.round(
    breakdown.hrv + breakdown.sleep_hours + breakdown.sleep_quality +
    breakdown.body_battery + breakdown.resting_hr +
    breakdown.tsb + breakdown.rest_days + breakdown.yesterday_tss -
    breakdown.spo2_penalty
  );

  const capped = Math.min(100, Math.max(0, score));
  const band = getBand(capped);

  // Check if we have real data (not just zeros)
  const hasRealData = (
    (breakdown.hrv > 0) ||
    (breakdown.sleep_hours > 0) ||
    (breakdown.body_battery > 0) ||
    (breakdown.tsb !== 0) ||
    (today?.hrv && today.hrv > 0) ||
    (today?.sleep_hours && today.sleep_hours > 0) ||
    (today?.body_battery && today.body_battery > 0)
  );

  if (!hasRealData) {
    return {
      score: 0,
      label: 'No data',
      color: '#6b7280',
      description: 'Connect Apple Health or log your morning metrics to see your readiness score.',
      breakdown,
      hasData: false,
    };
  }

  return {
    score: capped,
    label: band.label,
    color: band.color,
    description: band.description,
    breakdown,
    hasData: true,
  };
}

export function getAdjustmentFactor(score) {
  if (score >= 85) return 1.0;
  if (score >= 70) return 0.95;
  if (score >= 55) return 0.82;
  if (score >= 40) return 0.65;
  if (score >= 25) return 0.4;
  return 0;
}