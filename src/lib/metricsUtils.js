/**
 * Merge today's DailyMetrics row with the most-recent non-null value from
 * recent history, so UI tiles don't show "—" when Apple Health lags the
 * device by a day.
 *
 * Fields that come from Apple Health are filled from the newest row that has
 * a real value. Fields a user enters manually today (mood / legs / energy /
 * notes / injury / illness / morning check-in) always win from today's row.
 */
const APPLE_HEALTH_FIELDS = [
  "hrv",
  "resting_hr",
  "sleep_hours",
  "sleep_quality",
  "sleep_deep_minutes",
  "sleep_rem_minutes",
  "sleep_awake_minutes",
  "spo2",
  "body_battery",
  "active_calories",
  "respiratory_rate",
  "vo2_max",
  "weight_kg",
  "readiness_score",
  "ctl",
  "atl",
  "tsb",
];

function hasValue(v) {
  return v !== null && v !== undefined && v !== "" && !(typeof v === "number" && v === 0);
}

export function getEffectiveTodayMetrics(todayRow, allMetrics) {
  const base = todayRow ? { ...todayRow } : {};
  const sorted = [...(allMetrics || [])]
    .filter(m => m && m.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const fallbackSourceDates = {};
  for (const field of APPLE_HEALTH_FIELDS) {
    if (hasValue(base[field])) continue;
    const source = sorted.find(m => hasValue(m[field]));
    if (source) {
      base[field] = source[field];
      if (source.date !== base.date) fallbackSourceDates[field] = source.date;
    }
  }

  // Track which fields came from a fallback row so components can show a
  // "from MMM D" hint. Attached as a non-schema helper; components may ignore.
  base.__fallbackDates = fallbackSourceDates;
  return base;
}
