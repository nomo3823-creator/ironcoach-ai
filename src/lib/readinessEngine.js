/**
 * Readiness Engine — calculates a composite 0-100 readiness score
 * from DailyMetrics and recent Activities, with Apple Health integration.
 */

export const READINESS_BANDS = [
  { min: 85, max: 100, label: "Peak",     color: "#22c55e", description: "Your body is primed. This is a day to train hard." },
  { min: 70, max: 84,  label: "High",     color: "#84cc16", description: "You're recovered and ready. Normal training as planned." },
  { min: 55, max: 69,  label: "Moderate", color: "#eab308", description: "Some residual fatigue. Reduce intensity slightly, keep duration." },
  { min: 40, max: 54,  label: "Low",      color: "#f97316", description: "Your body needs more recovery. Easy sessions only today." },
  { min: 25, max: 39,  label: "Very Low", color: "#ef4444", description: "Significant fatigue detected. Consider rest or very easy movement only." },
  { min: 0,  max: 24,  label: "Rest",     color: "#dc2626", description: "Your body is telling you to stop. Rest day recommended." },
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

  // HRV (15 pts) — prioritize Apple Health HRV
  const last14 = sorted.slice(0, 14).filter(m => m.hrv > 0);
  if (today?.hrv && last14.length >= 3) {
    const baseline = last14.slice(1).reduce((s, m) => s + m.hrv, 0) / (last14.length - 1);
    const ratio = today.hrv / baseline;
    breakdown.hrv = ratio >= 1.0 ? 15 : ratio >= 0.95 ? 12 : ratio >= 0.90 ? 8 : ratio >= 0.80 ? 4 : 0;
    breakdown.hrv_baseline = Math.round(baseline);
    breakdown.hrv_today = today.hrv;
    breakdown.hrv_ratio = Math.round((ratio - 1) * 100);
    
    // Apple Watch signal: if HRV is >15% below baseline, flag as high fatigue
    if (ratio < 0.85) {
      breakdown.apple_watch_hrv_alert = true;
    }
  } else if (today?.hrv) {
    breakdown.hrv = 10; // default mid score if no baseline
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
  if (today?.spo2 && today.spo2 < 95) {
    breakdown.low_spo2_alert = true;
    breakdown.spo2_penalty = today.spo2 < 93 ? 10 : 5; // Deduct points if SpO2 is low
  }

  // ── TRAINING LOAD SIGNALS (50pts) ─────────────────────────────────────────

  // TSB (20 pts)
  const tsb = today?.tsb ?? null;
  if (tsb !== null) {
    breakdown.tsb = tsb > 15 ? 20 : tsb >= 5 ? 18 : tsb >= 0 ? 15 : tsb >= -5 ? 12 : tsb >= -10 ? 8 : tsb >= -20 ? 4 : 0;
    breakdown.tsb_value = tsb;
  }

  // Days since last rest day (15 pts)
  const actSorted = [...activities].sort((a, b) => b.date > a.date ? 1 : -1);
  let consecDays = 0;
  const todayStr = today?.date || new Date().toISOString().split('T')[0];
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