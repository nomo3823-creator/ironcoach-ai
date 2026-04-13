/**
 * Readiness Engine — calculates a composite 0-100 readiness score
 * from DailyMetrics and recent Activities, with Apple Health integration.
 */

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
  const today = sorted[0];

  const breakdown = {
    hrv: 0, sleep_hours: 0, sleep_quality: 0, body_battery: 0, resting_hr: 0,
    tsb: 0, rest_days: 0, yesterday_tss: 0, spo2_penalty: 0,
  };

  // ── RECOVERY SIGNALS (50pts) ──────────────────────────────────────────────

  // HRV (15 pts) — 7-day rolling mean vs 14-day baseline (more robust)
  const todayStr = today?.date || new Date().toISOString().split('T')[0];
  const last14 = sorted.filter(m => m.hrv > 0 && m.date <= todayStr).slice(-14);
  const last7hrv = sorted.filter(m => m.hrv > 0 && m.date <= todayStr).slice(-7);
  if (last14.length >= 3 && last7hrv.length >= 2) {
    const baseline14 = last14.reduce((s, m) => s + m.hrv, 0) / last14.length;
    const rolling7mean = last7hrv.reduce((s, m) => s + m.hrv, 0) / last7hrv.length;
    const ratio = rolling7mean / baseline14;
    breakdown.hrv = ratio >= 1.02 ? 15 : ratio >= 0.97 ? 12 : ratio >= 0.92 ? 8 : ratio >= 0.85 ? 4 : 0;
    breakdown.hrv_baseline = Math.round(baseline14);
    breakdown.hrv_today = today?.hrv || 0;
    breakdown.hrv_ratio = Math.round((ratio - 1) * 100);
    // Flag if 7-day mean is more than 8% below baseline (research threshold)
    if (ratio < 0.92) breakdown.apple_watch_hrv_alert = true;
  } else if (today?.hrv) {
    breakdown.hrv = 10;
  }

  // Sleep hours (10 pts)
  if (today?.sleep_hours) {
    const h = today.sleep_hours;
    breakdown.sleep_hours = h >= 8 ? 10 : h >= 7 ? 8 : h >= 6 ? 5 : 0;
  }

  // Sleep quality (10 pts) — Apple Health sleep analysis
  const sqMap = { excellent: 10, good: 8, fair: 4, poor: 0 };
  breakdown.sleep_quality = sqMap[today?.sleep_quality] ?? 0;

  // If sleep was poor, additional fatigue signal
  if (today?.sleep_quality === 'poor' || (today?.sleep_hours && today.sleep_hours < 6)) {
    breakdown.poor_sleep_alert = true;
  }

  // Body battery (10 pts)
  if (today?.body_battery) {
    const bb = today.body_battery;
    breakdown.body_battery = bb >= 80 ? 10 : bb >= 60 ? 8 : bb >= 40 ? 5 : 0;
  }

  // Resting HR (5 pts) — Apple Health resting HR
  const restHRs = sorted.slice(0, 14).filter(m => m.resting_hr > 0);
  if (today?.resting_hr && restHRs.length >= 3) {
    const baseline = restHRs.slice(1).reduce((s, m) => s + m.resting_hr, 0) / (restHRs.length - 1);
    const diff = today.resting_hr - baseline;
    breakdown.resting_hr = diff <= 0 ? 5 : diff <= 5 ? 3 : 0;
    breakdown.rhr_baseline = Math.round(baseline);
    breakdown.rhr_today = today.resting_hr;
  }

  // SpO2 signal (additional recovery metric from Apple Health)
  if (today?.spo2 && today.spo2 < 94) {
    breakdown.low_spo2_alert = true;
    breakdown.spo2_penalty = today.spo2 < 93 ? 10 : 5;
  }

  // ── TRAINING LOAD SIGNALS (50pts) ─────────────────────────────────────────

  // TSB (20 pts) — research-based thresholds (Mujika & Padilla 2003, Coggan PMC)
  const tsb = today?.tsb ?? null;
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

  return {
    score: capped,
    label: band.label,
    color: band.color,
    description: band.description,
    breakdown,
    hasData: today !== undefined,
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