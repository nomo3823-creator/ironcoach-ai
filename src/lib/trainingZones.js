// src/lib/trainingZones.js
// Based on Joe Friel's zone system and 80/20 Endurance methodology

export function calculateZones(profile) {
  const ftp = profile?.current_ftp || null;
  const thresholdRunPace = profile?.threshold_run_pace || null; // min/km as decimal e.g. 4.5 = 4:30/km
  const cssPerMin = profile?.css_per_100m ? profile.css_per_100m / 60 : null; // convert seconds to min/100m
  const maxHR = profile?.max_hr || null;
  const restingHR = profile?.resting_hr || null;
  const thresholdHR = maxHR ? Math.round(maxHR * 0.88) : null; // estimate LTHR as 88% max HR (Friel)

  // CYCLING POWER ZONES (% of FTP — Coggan model)
  const bike = ftp ? {
    z1: { min: 0,    max: Math.round(ftp * 0.55), label: "Active Recovery",  description: "Blood flow, flush legs. Conversation easy." },
    z2: { min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75), label: "Endurance", description: "All-day aerobic pace. Primary training zone." },
    z3: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90), label: "Tempo",     description: "Comfortably hard. Can speak in short sentences." },
    z4: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05), label: "Threshold", description: "FTP effort. 1-hour max sustainable." },
    z5: { min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20), label: "VO2 Max",   description: "3-8min max efforts. Very hard breathing." },
    z6: { min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.50), label: "Anaerobic", description: "30sec-2min all-out. Unsustainable." },
    ftp,
  } : null;

  // RUNNING PACE ZONES (% of threshold pace — Friel / 80/20 model)
  // thresholdRunPace in min/km decimal
  const run = thresholdRunPace ? (() => {
    const tp = thresholdRunPace;
    const paceLabel = (minPerKm) => {
      const mins = Math.floor(minPerKm);
      const secs = Math.round((minPerKm - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, "0")}/km`;
    };
    return {
      z1: { pace: paceLabel(tp * 1.29), label: "Recovery",   description: "Very easy. Can hold conversation fully." },
      z2: { pace: paceLabel(tp * 1.14), label: "Endurance",  description: "Easy aerobic. Building base. Nose breathing." },
      z3: { pace: paceLabel(tp * 1.06), label: "Tempo",      description: "Comfortably hard. Marathon race pace area." },
      z4: { pace: paceLabel(tp * 1.01), label: "Threshold",  description: "10K race effort. Hard to maintain conversation." },
      z5: { pace: paceLabel(tp * 0.94), label: "VO2 Max",    description: "5K race pace. Max aerobic effort." },
      threshold: paceLabel(tp),
      thresholdRaw: tp,
    };
  })() : null;

  // HEART RATE ZONES (% of LTHR — Friel model)
  const hrZones = thresholdHR ? {
    z1: { min: 0,                              max: Math.round(thresholdHR * 0.81), label: "Recovery",   description: "Below aerobic threshold." },
    z2: { min: Math.round(thresholdHR * 0.82), max: Math.round(thresholdHR * 0.89), label: "Endurance",  description: "Aerobic base building zone." },
    z3: { min: Math.round(thresholdHR * 0.90), max: Math.round(thresholdHR * 0.93), label: "Tempo",      description: "Moderate aerobic. Avoid overdoing." },
    z4: { min: Math.round(thresholdHR * 0.94), max: Math.round(thresholdHR * 0.99), label: "Threshold",  description: "Lactate threshold. Hard effort." },
    z5: { min: Math.round(thresholdHR * 1.00), max: maxHR || Math.round(thresholdHR * 1.06), label: "VO2 Max", description: "Max aerobic. Very hard." },
    lthr: thresholdHR,
    maxHR,
  } : null;

  // SWIM PACE ZONES (% of CSS — Critical Swim Speed)
  const swim = cssPerMin ? {
    z1: { pace: formatSwimPace(cssPerMin * 1.20), label: "Recovery",  description: "Very easy. Drill work, technique focus." },
    z2: { pace: formatSwimPace(cssPerMin * 1.10), label: "Endurance", description: "Comfortable aerobic. Long sets." },
    z3: { pace: formatSwimPace(cssPerMin * 1.03), label: "Tempo",     description: "Comfortably hard. 1500m race pace area." },
    z4: { pace: formatSwimPace(cssPerMin * 1.00), label: "CSS",       description: "Critical swim speed. Hard sustained effort." },
    z5: { pace: formatSwimPace(cssPerMin * 0.95), label: "Speed",     description: "Short fast reps. Sprint pace." },
    css: formatSwimPace(cssPerMin),
    cssRaw: cssPerMin,
  } : null;

  return { bike, run, hrZones, swim };
}

function formatSwimPace(minPer100m) {
  const mins = Math.floor(minPer100m);
  const secs = Math.round((minPer100m - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/100m`;
}

// Determine what intensity today's session should be based on readiness
export function getSessionIntensityModifier(readinessScore, tsb, hrv, hrv14DayBaseline) {
  const hrvRatio = (hrv && hrv14DayBaseline) ? hrv / hrv14DayBaseline : 1.0;

  // Research: Plews et al. 2013 — combine TSB and HRV signals
  // Norwegian elite coach model — hard/easy alternation is fundamental
  if (readinessScore >= 80 && tsb >= -15 && tsb <= 10 && hrvRatio >= 0.95) {
    return { modifier: 1.0, recommendation: "full", label: "Full session as planned", color: "#14b8a6" };
  }
  if (readinessScore >= 65 || (tsb >= -20 && hrvRatio >= 0.90)) {
    return { modifier: 0.9, recommendation: "slightly_reduced", label: "Slight reduction — keep intensity, trim volume 10%", color: "#0ea5e9" };
  }
  if (readinessScore >= 50 || tsb >= -25) {
    return { modifier: 0.75, recommendation: "reduced", label: "Reduce to 75% — drop intensity one zone, keep duration", color: "#f59e0b" };
  }
  if (readinessScore >= 35) {
    return { modifier: 0.5, recommendation: "easy_only", label: "Easy session only — Zone 1-2 max, 50% of planned duration", color: "#f97316" };
  }
  return { modifier: 0, recommendation: "rest", label: "Rest or very light movement only", color: "#ef4444" };
}