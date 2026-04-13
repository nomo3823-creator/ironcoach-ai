/**
 * Universal race type definitions for the coaching platform.
 * Supports any endurance event: triathlon, running, cycling, custom.
 */

export const RACE_TYPES = [
  // Triathlon
  { value: "sprint_tri",   label: "Sprint Triathlon",       sports: ["swim","bike","run"], taperWeeks: 1, description: "750m swim · 20km bike · 5km run" },
  { value: "olympic_tri",  label: "Olympic Triathlon",       sports: ["swim","bike","run"], taperWeeks: 1, description: "1.5km swim · 40km bike · 10km run" },
  { value: "70.3",         label: "Half Ironman 70.3",       sports: ["swim","bike","run"], taperWeeks: 2, description: "1.9km swim · 90km bike · 21.1km run" },
  { value: "140.6",        label: "Full Ironman 140.6",      sports: ["swim","bike","run"], taperWeeks: 3, description: "3.8km swim · 180km bike · 42.2km run" },
  // Running
  { value: "5k",           label: "5K Run",                  sports: ["run"],               taperWeeks: 1, description: "5 kilometer road or track race" },
  { value: "10k",          label: "10K Run",                  sports: ["run"],               taperWeeks: 1, description: "10 kilometer road race" },
  { value: "half_marathon",label: "Half Marathon",            sports: ["run"],               taperWeeks: 1, description: "21.1km road race" },
  { value: "marathon",     label: "Marathon",                 sports: ["run"],               taperWeeks: 2, description: "42.2km road race" },
  { value: "ultramarathon",label: "Ultramarathon",            sports: ["run"],               taperWeeks: 2, description: "50km+ trail or road ultra" },
  // Cycling
  { value: "gran_fondo",   label: "Cycling Gran Fondo",       sports: ["bike"],              taperWeeks: 1, description: "Long-distance mass-participation cycling event" },
  { value: "century_ride", label: "Century Ride (100 miles)", sports: ["bike"],              taperWeeks: 1, description: "100-mile cycling challenge" },
  // Open water / Swim
  { value: "open_water",   label: "Open Water Swim",          sports: ["swim"],              taperWeeks: 1, description: "Lake or ocean swimming race" },
  // Custom
  { value: "custom",       label: "Custom Event",             sports: ["swim","bike","run"], taperWeeks: 1, description: "Enter your own race type and distance" },
];

/**
 * Look up a race type by its value key.
 * Falls back to a generic "Custom Event" entry if not found.
 */
export function getRaceType(value) {
  return RACE_TYPES.find(r => r.value === value) || {
    value: value || "custom",
    label: value || "Custom Event",
    sports: ["swim","bike","run"],
    taperWeeks: 1,
    description: "",
  };
}

/** Return the human-readable label for a race type value. */
export function getRaceLabel(value) {
  return getRaceType(value)?.label || value || "Race";
}

/** Return the array of sports for a race type. */
export function getRaceSports(value) {
  return getRaceType(value)?.sports || ["swim","bike","run"];
}

/**
 * Calculate a periodized phase breakdown given total weeks to race.
 *
 * Returns { base, build, peak, taper } in whole weeks.
 * Phases:
 *   ≤4 weeks: condensed (Base + Taper only)
 *   ≤8 weeks: Base + Build + Taper
 *   >8 weeks: full Base + Build + Peak + Taper
 */
export function calculatePhases(totalWeeks, taperWeeks = 1) {
  const taper = Math.max(1, Math.min(taperWeeks, Math.floor(totalWeeks * 0.2)));
  const remaining = totalWeeks - taper;

  if (remaining <= 3) {
    return { base: remaining, build: 0, peak: 0, taper };
  }
  if (remaining <= 6) {
    const base = Math.ceil(remaining * 0.6);
    const build = remaining - base;
    return { base, build, peak: 0, taper };
  }
  // Full periodization
  const peak = Math.max(1, Math.round(remaining * 0.15));
  const build = Math.round(remaining * 0.35);
  const base = remaining - peak - build;
  return { base, build, peak, taper };
}

/**
 * Build a human-readable phase summary string, e.g.
 * "Base (8w) → Build (6w) → Peak (3w) → Taper (2w)"
 */
export function formatPhases(phases) {
  return Object.entries(phases)
    .filter(([, weeks]) => weeks > 0)
    .map(([phase, weeks]) => `${phase.charAt(0).toUpperCase() + phase.slice(1)} (${weeks}w)`)
    .join(" → ");
}
