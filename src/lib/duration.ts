// Parses ISO 8601 durations like "PT1H30M" or "PT45M" into whole minutes.
// Returns null if the input isn't a recognizable ISO duration.
export function parseIsoDurationToMinutes(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const match = input.trim().match(
    /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!match) return null;

  const [, years, months, weeks, days, hours, minutes, seconds] = match;
  if (!hours && !minutes && !seconds && !days && !weeks && !months && !years) return null;

  const totalMinutes =
    (Number(years || 0) * 365 * 24 * 60) +
    (Number(months || 0) * 30 * 24 * 60) +
    (Number(weeks || 0) * 7 * 24 * 60) +
    (Number(days || 0) * 24 * 60) +
    (Number(hours || 0) * 60) +
    Number(minutes || 0) +
    Math.round(Number(seconds || 0) / 60);

  return totalMinutes > 0 ? totalMinutes : null;
}

// Falls back to parsing plain-language time text like "15 minutes", "1 hr 30 min",
// or a bare "45" (assumed minutes). Some recipe plugins put human-readable text
// in prepTime/cookTime instead of a proper ISO 8601 duration — this covers those.
function parsePlainTextDurationToMinutes(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;

  let totalMinutes = 0;
  let matched = false;

  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/);
  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1]) * 60;
    matched = true;
  }
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/);
  if (minMatch) {
    totalMinutes += parseFloat(minMatch[1]);
    matched = true;
  }
  if (!matched) {
    const bare = s.match(/^(\d+(?:\.\d+)?)$/);
    if (bare) {
      totalMinutes = parseFloat(bare[1]);
      matched = true;
    }
  }

  return matched ? Math.round(totalMinutes) : null;
}

// Combined parser: tries strict ISO 8601 first, then falls back to plain text.
export function parseDurationToMinutes(input: unknown): number | null {
  return parseIsoDurationToMinutes(input) ?? parsePlainTextDurationToMinutes(input);
}
