// Parses a quantity string like "2", "1/2", or "1 1/2" into a number.
// Returns null for anything that isn't a clean number/fraction (e.g. "a pinch", "2-3"),
// so callers can fall back to showing the original text unscaled.
export function parseQuantityToNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Mixed number: "1 1/2"
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) {
    const whole = parseInt(m[1], 10);
    const num = parseInt(m[2], 10);
    const den = parseInt(m[3], 10);
    if (!den) return null;
    return whole + num / den;
  }

  // Simple fraction: "1/2"
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) {
    const num = parseInt(m[1], 10);
    const den = parseInt(m[2], 10);
    if (!den) return null;
    return num / den;
  }

  // Decimal or whole number: "2", "2.5"
  if (/^\d+(\.\d+)?$/.test(s)) {
    return parseFloat(s);
  }

  return null;
}

// Common cooking fractions, used to snap scaled results back to something
// a person would actually write on a recipe card instead of an ugly decimal.
const FRACTIONS: [number, string][] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];
const SNAP_TOLERANCE = 0.04;

export function formatScaledNumber(value: number): string {
  if (value <= 0) return "0";

  const whole = Math.floor(value);
  const frac = value - whole;

  // Close enough to the next whole number — round up rather than showing e.g. "1 7/8" as "2".
  if (frac > 1 - SNAP_TOLERANCE) {
    return `${whole + 1}`;
  }
  if (frac < SNAP_TOLERANCE) {
    return `${whole}`;
  }

  let bestLabel: string | null = null;
  let bestDiff = Infinity;
  for (const [val, label] of FRACTIONS) {
    const diff = Math.abs(frac - val);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLabel = label;
    }
  }

  if (bestLabel && bestDiff <= SNAP_TOLERANCE) {
    return whole > 0 ? `${whole} ${bestLabel}` : bestLabel;
  }

  // No clean fraction match — fall back to a trimmed decimal.
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
}

// Scales a raw quantity string by a factor, returning the original text
// unchanged if it isn't a recognizable number (e.g. "to taste", "a pinch").
export function scaleQuantityText(raw: string, scale: number): string {
  const value = parseQuantityToNumber(raw);
  if (value === null) return raw;
  return formatScaledNumber(value * scale);
}
