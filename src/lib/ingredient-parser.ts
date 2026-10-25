export interface ParsedIngredient {
  raw: string;
  quantity: string | null;
  unit: string | null;
  item: string;
  // Which part of the recipe this belongs to, e.g. "Meatballs" or "For the sauce".
  // Missing for recipes without groups.
  group?: string | null;
}

const UNIT_WORDS = [
  "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
  "ounce", "ounces", "oz", "pound", "pounds", "lb", "lbs", "gram", "grams", "g", "kg",
  "kilogram", "kilograms", "ml", "milliliter", "milliliters", "liter", "liters", "l",
  "pinch", "pinches", "dash", "clove", "cloves", "can", "cans", "package", "packages",
  "pkg", "slice", "slices", "stick", "sticks", "bunch", "bunches", "head", "heads",
  "quart", "quarts", "pint", "pints", "gallon", "gallons",
];

const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

function normalizeFractions(text: string): string {
  let out = text;
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.split(glyph).join(ascii);
  }
  return out;
}

// Splits a raw ingredient line like "2 1/2 cups all-purpose flour, sifted"
// into quantity ("2 1/2"), unit ("cups"), and item ("all-purpose flour, sifted").
// This is a best-effort heuristic, not a full NLP parser — it's meant to make
// grocery-list aggregation and display cleaner, not to be perfectly precise.
export function parseIngredientLine(rawInput: string): ParsedIngredient {
  const raw = rawInput.trim().replace(/\s+/g, " ");
  const normalized = normalizeFractions(raw);

  const qtyMatch = normalized.match(
    /^([\d]+(?:\/\d+)?(?:\s+\d+\/\d+)?(?:\.\d+)?(?:\s*-\s*\d+(?:\/\d+)?)?)\s+(.*)$/
  );

  if (!qtyMatch) {
    return { raw, quantity: null, unit: null, item: normalized };
  }

  const quantity = qtyMatch[1].trim();
  const rest = qtyMatch[2].trim();

  const restWords = rest.split(" ");
  const firstWord = restWords[0]?.toLowerCase().replace(/[.,]/g, "");

  if (firstWord && UNIT_WORDS.includes(firstWord)) {
    return {
      raw,
      quantity,
      unit: restWords[0].replace(/[.,]/g, ""),
      item: restWords.slice(1).join(" "),
    };
  }

  return { raw, quantity, unit: null, item: rest };
}

// In the ingredients box, a line ending in a colon ("Meatballs:", "For the sauce:")
// starts a new group instead of being an ingredient.
export function groupHeadingOf(line: string): string | null {
  const text = line.trim();
  if (!text.endsWith(":") || text.length > 60 || /^[\d¼½¾⅓⅔⅛]/.test(text)) return null;
  const name = text.slice(0, -1).trim();
  return name || null;
}

// Turns the ingredients box (one line each, with optional "Group:" headings)
// into ingredients that remember their group.
export function parseIngredientLines(text: string): ParsedIngredient[] {
  let group: string | null = null;
  const result: ParsedIngredient[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const heading = groupHeadingOf(line);
    if (heading) {
      group = heading;
      continue;
    }
    result.push({ ...parseIngredientLine(line), ...(group ? { group } : {}) });
  }
  return result;
}

// The reverse, for filling the ingredients box: adds a "Group:" line wherever the group changes.
export function ingredientsToText(ingredients: { raw: string; group?: string | null }[]): string {
  const lines: string[] = [];
  let current: string | null = null;
  for (const ing of ingredients) {
    const group = ing.group || null;
    if (group && group !== current) lines.push(`${group}:`);
    current = group;
    lines.push(ing.raw);
  }
  return lines.join("\n");
}

// The group heading to show above ingredient i, or null if it continues the group before it.
export function startsGroup(ingredients: { group?: string | null }[], i: number): string | null {
  const group = ingredients[i]?.group || null;
  return group && group !== (ingredients[i - 1]?.group || null) ? group : null;
}
