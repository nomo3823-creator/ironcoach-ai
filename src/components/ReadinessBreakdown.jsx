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
  if (readiness.breakdown.hrv_baseline) {
    signals.push({
      name: "HRV",
      earned: readiness.breakdown.hrv,
      max: 15,
      tooltip: "out of 15",
      alert: readiness.breakdown.apple_watch_hrv_alert,
      explanation: `HRV ${readiness.breakdown.hrv_today}ms is ${Math.round(readiness.breakdown.hrv_ratio * 100)}% ${readiness.breakdown.hrv_ratio >= 1 ? "above" : "below"} your 14-day baseline of ${readiness.breakdown.hrv_baseline}ms`,
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
  const sleepLabel =
    readiness.breakdown.sleep_hours >= 7
      ? "good"
      : readiness.breakdown.sleep_hours >= 6
        ? "short"
        : "inadequate";
  signals.push({
    name: "Sleep Duration",
    earned: readiness.breakdown.sleep_hours_pts,
    max: 10,
    tooltip: "out of 10",
    explanation: `Slept ${readiness.breakdown.sleep_hours}h — ${sleepLabel}`,
  });

  // 3. Sleep quality
  signals.push({
    name: "Sleep Quality",
    earned: readiness.breakdown.sleep_quality_pts,
    max: 10,
    tooltip: "out of 10",
    alert: readiness.breakdown.poor_sleep_alert,
    explanation: readiness.breakdown.poor_sleep_alert
      ? "Poor sleep flagged — recovery compromised"
      : `Quality: ${readiness.breakdown.sleep_quality || "good"}`,
  });

  // 4. Body battery (omit if no data)
  if (readiness.breakdown.body_battery !== null && readiness.breakdown.body_battery !== undefined) {
    const batteryLabel =
      readiness.breakdown.body_battery >= 80
        ? "fresh"
        : readiness.breakdown.body_battery >= 60
          ? "rested"
          : "depleted";
    signals.push({
      name: "Body Battery",
      earned: readiness.breakdown.body_battery_pts,
      max: 10,
      tooltip: "out of 10",
      explanation: `${readiness.breakdown.body_battery}/100 — ${batteryLabel}`,
    });
  }

  // 5. Resting HR (omit if no data)
  if (readiness.breakdown.rhr_baseline && readiness.breakdown.rhr_today) {
    const diff = readiness.breakdown.rhr_today - readiness.breakdown.rhr_baseline;
    signals.push({
      name: "Resting HR",
      earned: readiness.breakdown.resting_hr_pts,
      max: 5,
      tooltip: "out of 5",
      explanation: `Resting HR ${readiness.breakdown.rhr_today}bpm vs ${readiness.breakdown.rhr_baseline}bpm baseline (${diff > 0 ? "+" : ""}${diff}bpm)`,
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
  signals.push({
    name: "Form (TSB)",
    earned: readiness.breakdown.tsb_pts,
    max: 20,
    tooltip: "out of 20",
    explanation: `TSB ${readiness.breakdown.tsb_value} — ${readiness.breakdown.tsb_interpretation || "training load normal"}`,
  });

  // 8. Consecutive rest days
  const dayLabel =
    readiness.breakdown.consecutive_days <= 2
      ? "good"
      : readiness.breakdown.consecutive_days === 3
        ? "moderate"
        : "high";
  signals.push({
    name: "Training Streak",
    earned: readiness.breakdown.rest_days_pts,
    max: 15,
    tooltip: "out of 15",
    explanation: `${readiness.breakdown.consecutive_days} day(s) in a row — ${dayLabel}`,
  });

  // 9. Yesterday's TSS
  const tssLabel =
    readiness.breakdown.yesterday_tss_value < 50
      ? "recovered"
      : readiness.breakdown.yesterday_tss_value <= 120
        ? "moderate"
        : "heavy";
  signals.push({
    name: "Yesterday's Load",
    earned: readiness.breakdown.yesterday_tss_pts,
    max: 15,
    tooltip: "out of 15",
    explanation: `Yesterday: ${readiness.breakdown.yesterday_tss_value} TSS — ${tssLabel}`,
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