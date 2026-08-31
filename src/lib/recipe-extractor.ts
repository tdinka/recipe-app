import * as cheerio from "cheerio";
import { parseDurationToMinutes } from "@/lib/duration";
import { parseIngredientLine, type ParsedIngredient } from "@/lib/ingredient-parser";

export interface ExtractedRecipe {
  title: string;
  sourceUrl: string;
  imageUrl: string | null;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  // Only set when the source only publishes a combined time (no prep/cook split).
  totalMinutes: number | null;
  category: string | null;
  cuisine: string | null;
  ingredients: ParsedIngredient[];
  instructions: string[];
}

export class RecipeExtractionError extends Error {}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return textOf(value[0]);
  if (value && typeof value === "object") {
    // Common schema.org patterns: { "@value": "..." } or { name: "..." } or { text: "..." }
    const obj = value as Record<string, unknown>;
    return textOf(obj["@value"] ?? obj.name ?? obj.text ?? null);
  }
  return null;
}

function imageOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageOf(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return textOf(obj.url) ?? null;
  }
  return null;
}

function servingsOf(value: unknown): number | null {
  const text = textOf(value);
  if (!text) return null;
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function ingredientsOf(value: unknown): ParsedIngredient[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => textOf(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map((entry) => parseIngredientLine(entry));
}

function instructionsOf(value: unknown): string[] {
  if (typeof value === "string") {
    // Some sites put the whole method as one HTML/plain-text blob; split on line breaks.
    return value
      .split(/\r?\n+/)
      .map((s) => s.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];

  const steps: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      steps.push(entry.trim());
      continue;
    }
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      if (obj["@type"] === "HowToSection" && Array.isArray(obj.itemListElement)) {
        steps.push(...instructionsOf(obj.itemListElement));
        continue;
      }
      const text = textOf(obj.text ?? obj.name);
      if (text) steps.push(text);
    }
  }
  return steps.filter(Boolean);
}

// Falls back to HTML microdata (itemprop="prepTime"/"cookTime") when the
// JSON-LD recipe node doesn't include a given field at all — some sites only
// mark these up on the visible page rather than in structured data.
function findMicrodataDuration($: cheerio.CheerioAPI, prop: "prepTime" | "cookTime" | "totalTime"): string | null {
  const el = $(`[itemprop="${prop}"]`).first();
  if (el.length === 0) return null;
  return el.attr("datetime") || el.attr("content") || el.text().trim() || null;
}
function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findRecipeNode(entry);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const typeList = Array.isArray(type) ? type : [type];
    if (typeList.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
      return obj;
    }
    if (Array.isArray(obj["@graph"])) {
      const found = findRecipeNode(obj["@graph"]);
      if (found) return found;
    }
  }

  return null;
}

export async function extractRecipeFromUrl(url: string): Promise<ExtractedRecipe> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new RecipeExtractionError("That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new RecipeExtractionError("Only http(s) links are supported.");
  }

  let html: string;
  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        // Some recipe sites block requests with no browser-like UA.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new RecipeExtractionError(`The page returned an error (HTTP ${res.status}).`);
    }
    html = await res.text();
  } catch (err) {
    if (err instanceof RecipeExtractionError) throw err;
    throw new RecipeExtractionError("Couldn't reach that URL. Check the link and try again.");
  }

  const $ = cheerio.load(html);

  let recipeNode: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (recipeNode) return;
    try {
      const json = JSON.parse($(el).contents().text());
      recipeNode = findRecipeNode(json);
    } catch {
      // Malformed JSON-LD on the page — skip it and keep looking.
    }
  });

  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDescription = $('meta[property="og:description"]').attr("content");

  if (!recipeNode) {
    // No structured recipe data found. Fall back to whatever we can salvage
    // from Open Graph tags so the user still gets a usable starting point.
    const title = ogTitle || $("title").text().trim();
    if (!title) {
      throw new RecipeExtractionError(
        "We couldn't find recipe details on that page. Try a different link, or add the recipe manually."
      );
    }
    return {
      title,
      sourceUrl: parsedUrl.toString(),
      imageUrl: ogImage || null,
      description: ogDescription || null,
      servings: null,
      prepMinutes: parseDurationToMinutes(findMicrodataDuration($, "prepTime")),
      cookMinutes: parseDurationToMinutes(findMicrodataDuration($, "cookTime")),
      totalMinutes: parseDurationToMinutes(findMicrodataDuration($, "totalTime")),
      category: null,
      cuisine: null,
      ingredients: [],
      instructions: [],
    };
  }

  const node = recipeNode as Record<string, unknown>;

  return {
    title: textOf(node.name) || ogTitle || "Untitled recipe",
    sourceUrl: parsedUrl.toString(),
    imageUrl: imageOf(node.image) || ogImage || null,
    description: textOf(node.description) || ogDescription || null,
    servings: servingsOf(node.recipeYield),
    prepMinutes: parseDurationToMinutes(node.prepTime) ?? parseDurationToMinutes(findMicrodataDuration($, "prepTime")),
    cookMinutes: parseDurationToMinutes(node.cookTime) ?? parseDurationToMinutes(findMicrodataDuration($, "cookTime")),
    totalMinutes: parseDurationToMinutes(node.totalTime) ?? parseDurationToMinutes(findMicrodataDuration($, "totalTime")),
    category: textOf(node.recipeCategory),
    cuisine: textOf(node.recipeCuisine),
    ingredients: ingredientsOf(node.recipeIngredient),
    instructions: instructionsOf(node.recipeInstructions),
  };
}
