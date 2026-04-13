export const sportColors = {
  swim:     { hex: "#0ea5e9", textClass: "text-swim",     bgClass: "bg-swim",     borderClass: "border-swim"     },
  bike:     { hex: "#f59e0b", textClass: "text-bike",     bgClass: "bg-bike",     borderClass: "border-bike"     },
  run:      { hex: "#ef4444", textClass: "text-run",      bgClass: "bg-run",      borderClass: "border-run"      },
  brick:    { hex: "#a855f7", textClass: "text-brick",    bgClass: "bg-brick",    borderClass: "border-brick"    },
  recovery: { hex: "#14b8a6", textClass: "text-recovery", bgClass: "bg-recovery", borderClass: "border-recovery" },
  rest:     { hex: "#14b8a6", textClass: "text-recovery", bgClass: "bg-recovery", borderClass: "border-recovery" },
  strength: { hex: "#6b7280", textClass: "text-muted-foreground", bgClass: "bg-muted", borderClass: "border-border" },
  other:    { hex: "#6b7280", textClass: "text-muted-foreground", bgClass: "bg-muted", borderClass: "border-border" },
};

export const sportIcons = {
  swim: "🏊", bike: "🚴", run: "🏃", brick: "🔥",
  strength: "💪", rest: "😴", recovery: "🧘", other: "⚡",
};

export const phaseLabels = {
  base: "Base", build: "Build", peak: "Peak", taper: "Taper", race_week: "Race Week",
};

export const intensityColors = {
  easy: "#14b8a6", moderate: "#0ea5e9", hard: "#f59e0b", race_pace: "#ef4444", recovery: "#6b7280",
};

export function formatDuration(minutes) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getReadinessColor(score) {
  if (score >= 85) return "#14b8a6";
  if (score >= 70) return "#0ea5e9";
  if (score >= 55) return "#f59e0b";
  if (score >= 40) return "#f97316";
  if (score >= 20) return "#ef4444";
  return "#dc2626";
}

export function getReadinessLabel(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Moderate";
  if (score >= 40) return "Low";
  if (score >= 20) return "Very Low";
  return "Rest";
}