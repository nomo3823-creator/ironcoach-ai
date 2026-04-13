import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReadinessBreakdown({ readiness }) {
  const [expanded, setExpanded] = useState(false);

  if (!readiness?.hasData) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <p className="text-sm font-medium text-foreground">Ready to see your readiness score?</p>
        <p className="text-xs text-muted-foreground">Log today's metrics to get a personalized readiness breakdown.</p>
        <Link to="/recovery" className="inline-block text-xs text-primary font-medium hover:underline">
          Log metrics →
        </Link>
      </div>
    );
  }

  const getSignalColor = (earned, max) => {
    const ratio = earned / max;
    if (ratio >= 0.7) return "bg-green-600/30 border-green-600/50";
    if (ratio >= 0.4) return "bg-amber-600/30 border-amber-600/50";
    return "bg-red-600/30 border-red-600/50";
  };

  const signals = [];

  // 1. HRV
  const hrvToday = readiness.breakdown.hrv_today;
  const hrvBaseline = readiness.breakdown.hrv_baseline;
  const hrvRatio = readiness.breakdown.hrv_ratio;
  
  if (hrvBaseline && hrvToday && hrvToday > 0) {
    // Cap percentage at ±200% to avoid absurd displays
    const displayRatio = hrvRatio && Math.abs(hrvRatio) > 200 ? (hrvRatio >= 0 ? 200 : -200) : hrvRatio;
    signals.push({
      name: "HRV",
      earned: readiness.breakdown.hrv,
      max: 15,
      tooltip: "out of 15",
      alert: readiness.breakdown.apple_watch_hrv_alert,
      explanation: `HRV ${hrvToday}ms is ${Math.round(displayRatio)}% ${hrvRatio >= 0 ? "above" : "below"} your 14-day baseline of ${hrvBaseline}ms`,
    });
  } else if (hrvBaseline && (!hrvToday || hrvToday === 0)) {
    signals.push({
      name: "HRV",
      earned: 0,
      max: 15,
      tooltip: "out of 15",
      explanation: "No HRV reading today — connect Apple Health to track",
    });
  } else {
    signals.push({
      name: "HRV",
      earned: 0,
      max: 15,
      tooltip: "out of 15",
      explanation: "Not enough HRV history for a personal baseline",
    });
  }

  // 2. Sleep duration
  const sleepHours = readiness.breakdown.sleep_hours_value || readiness.breakdown.sleep_hours;
  const sleepLabel =
    sleepHours && sleepHours >= 7
      ? "good"
      : sleepHours && sleepHours >= 6
        ? "short"
        : "inadequate";
  signals.push({
    name: "Sleep Duration",
    earned: readiness.breakdown.sleep_hours,
    max: 10,
    tooltip: "out of 10",
    explanation: sleepHours ? `Slept ${sleepHours}h — ${sleepLabel}` : "No sleep data",
  });

  // 3. Sleep quality
  signals.push({
    name: "Sleep Quality",
    earned: readiness.breakdown.sleep_quality,
    max: 10,
    tooltip: "out of 10",
    alert: readiness.breakdown.poor_sleep_alert,
    explanation: readiness.breakdown.poor_sleep_alert
      ? "Poor sleep flagged — recovery compromised"
      : `Quality: ${readiness.breakdown.sleep_quality_value || readiness.breakdown.sleep_quality || "good"}`,
  });

  // 4. Body battery (omit if no data)
  const bodyBattery = readiness.breakdown.body_battery_value;
  if (bodyBattery !== null && bodyBattery !== undefined && bodyBattery > 0) {
    const batteryLabel =
      bodyBattery >= 80
        ? "fresh"
        : bodyBattery >= 60
          ? "rested"
          : "depleted";
    signals.push({
      name: "Body Battery",
      earned: readiness.breakdown.body_battery,
      max: 10,
      tooltip: "out of 10",
      explanation: `${bodyBattery}/100 — ${batteryLabel}`,
    });
  }

  // 5. Resting HR (omit if no data)
  const rhrToday = readiness.breakdown.rhr_today;
  const rhrBaseline = readiness.breakdown.rhr_baseline;
  if (rhrBaseline && rhrToday && rhrToday > 0) {
    const diff = rhrToday - rhrBaseline;
    signals.push({
      name: "Resting HR",
      earned: readiness.breakdown.resting_hr,
      max: 5,
      tooltip: "out of 5",
      explanation: `Resting HR ${rhrToday}bpm vs ${rhrBaseline}bpm baseline (${diff > 0 ? "+" : ""}${diff}bpm)`,
    });
  }

  // 6. SpO2 (only if penalty > 0)
  if (readiness.breakdown.spo2_penalty > 0) {
    signals.push({
      name: "SpO2",
      earned: Math.max(0, 10 - readiness.breakdown.spo2_penalty),
      max: 10,
      tooltip: "out of 10",
      alert: readiness.breakdown.low_spo2_alert,
      explanation: `SpO2 ${readiness.breakdown.low_spo2_value}% — possible illness signal (-${readiness.breakdown.spo2_penalty} pts)`,
    });
  }

  // 7. TSB / Form
  {
    const tsbVal = readiness.breakdown.tsb_value;
    const tsbText = typeof tsbVal === "number"
      ? `TSB ${Math.round(tsbVal * 10) / 10} — ${readiness.breakdown.tsb_interpretation || "training load normal"}`
      : "Not enough recent activity data for a TSB signal";
    signals.push({
      name: "Form (TSB)",
      earned: readiness.breakdown.tsb ?? 0,
      max: 20,
      tooltip: "out of 20",
      explanation: tsbText,
    });
  }

  // 8. Consecutive rest days
  const dayLabel =
    readiness.breakdown.consecutive_days <= 2
      ? "good"
      : readiness.breakdown.consecutive_days === 3
        ? "moderate"
        : "high";
  signals.push({
    name: "Training Streak",
    earned: readiness.breakdown.rest_days ?? 0,
    max: 15,
    tooltip: "out of 15",
    explanation: `${readiness.breakdown.consecutive_days ?? 0} day(s) in a row — ${dayLabel}`,
  });

  // 9. Yesterday's TSS
  const yTSS = readiness.breakdown.yesterday_tss_value ?? 0;
  const tssLabel = yTSS < 50 ? "recovered" : yTSS <= 120 ? "moderate" : "heavy";
  signals.push({
    name: "Yesterday's Load",
    earned: readiness.breakdown.yesterday_tss ?? 0,
    max: 15,
    tooltip: "out of 15",
    explanation: `Yesterday: ${yTSS} TSS — ${tssLabel}`,
  });

  const bandDescriptions = {
    Excellent: "Your body is primed for hard training. Low injury risk.",
    Good: "Well-recovered. Ready for structured work.",
    Moderate: "Serviceable. Choose workouts strategically.",
    Low: "Tired. Consider easier training or extra recovery.",
    "Very Low": "Heavily fatigued. Prioritize rest and easy sessions.",
    Rest: "Recovery day. Light activity only.",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-foreground">Why your readiness is {readiness.score}/100</h3>
          <Badge style={{ backgroundColor: readiness.color + "20", color: readiness.color }} className="border-0">
            {readiness.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{readiness.description}</p>
      </div>

      {/* Signal rows */}
      <div className="space-y-3">
        {signals.map((signal, idx) => {
          const barRatio = signal.earned / signal.max;
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground flex-shrink-0" title={signal.tooltip}>
                    {signal.name}
                  </p>
                  {signal.alert && (
                    <span className="text-xs text-amber-600 font-medium whitespace-nowrap">⚠ Alert</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono flex-shrink-0">
                  {signal.earned} / {signal.max}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", getSignalColor(signal.earned, signal.max))}
                  style={{ width: `${barRatio * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{signal.explanation}</p>
            </div>
          );
        })}
      </div>

      {/* Collapsible footer */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 pt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <span>What does this mean?</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">85–100 Excellent:</span> {bandDescriptions.Excellent}
            </p>
            <p>
              <span className="font-medium text-foreground">70–84 Good:</span> {bandDescriptions.Good}
            </p>
            <p>
              <span className="font-medium text-foreground">55–69 Moderate:</span> {bandDescriptions.Moderate}
            </p>
            <p>
              <span className="font-medium text-foreground">40–54 Low:</span> {bandDescriptions.Low}
            </p>
            <p>
              <span className="font-medium text-foreground">20–39 Very Low:</span> {bandDescriptions["Very Low"]}
            </p>
            <p>
              <span className="font-medium text-foreground">0–19 Rest:</span> {bandDescriptions.Rest}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}