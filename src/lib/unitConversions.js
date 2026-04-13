// Metric to US conversions
export const kmToMiles = (km) => (km * 0.621371).toFixed(1);
export const kgToLbs = (kg) => (kg * 2.20462).toFixed(1);
export const cmToInches = (cm) => (cm * 0.393701).toFixed(1);
export const mToFeet = (m) => (m * 3.28084).toFixed(1);
export const celsiusToFahrenheit = (c) => ((c * 9/5) + 32).toFixed(1);

export const formatDistance = (km) => {
  if (!km) return "—";
  return `${km.toFixed(1)}km / ${kmToMiles(km)}mi`;
};

export const formatWeight = (kg) => {
  if (!kg) return "—";
  return `${kg.toFixed(1)}kg / ${kgToLbs(kg)}lbs`;
};

export const formatHeight = (cm) => {
  if (!cm) return "—";
  const inches = parseFloat(cmToInches(cm));
  const feet = Math.floor(inches / 12);
  const remainingInches = (inches % 12).toFixed(1);
  return `${cm}cm / ${feet}'${remainingInches}"`;
};

export const formatElevation = (m) => {
  if (!m) return "—";
  return `${m.toFixed(0)}m / ${mToFeet(m)}'`;
};

export const formatTemp = (c) => {
  if (!c) return "—";
  return `${c.toFixed(1)}°C / ${celsiusToFahrenheit(c)}°F`;
};