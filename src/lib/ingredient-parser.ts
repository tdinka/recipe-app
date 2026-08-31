export interface ParsedIngredient {
  raw: string;
  quantity: string | null;
  unit: string | null;
  item: string;
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
