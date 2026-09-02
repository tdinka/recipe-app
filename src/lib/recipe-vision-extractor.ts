import { z } from "zod";
import { parseIngredientLine, type ParsedIngredient } from "@/lib/ingredient-parser";
import { CATEGORIES } from "@/lib/constants";

export interface ExtractedRecipeFromImage {
  title: string;
  sourceUrl: null;
  imageUrl: null;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  category: string | null;
  cuisine: string | null;
  ingredients: ParsedIngredient[];
  instructions: string[];
}

export class VisionExtractionError extends Error {}

const modelOutputSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  servings: z.number().nullable().optional(),
  prepMinutes: z.number().nullable().optional(),
  cookMinutes: z.number().nullable().optional(),
  totalMinutes: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  ingredients: z.array(z.string()).optional(),
  instructions: z.array(z.string()).optional(),
});

const SYSTEM_PROMPT = `You extract recipe information from images (screenshots of recipe websites, photos of cookbook pages, handwritten recipe cards, etc).

Respond with ONLY a single JSON object — no markdown code fences, no commentary before or after. It must match exactly this shape:

{
  "title": string or null,
  "description": string or null (a short summary, only if one is actually present in the image),
  "servings": number or null,
  "prepMinutes": number or null (convert any stated prep time to minutes),
  "cookMinutes": number or null (convert any stated cook/bake time to minutes),
  "totalMinutes": number or null (only if the image shows a single combined time rather than a prep/cook split — leave null if prep and cook are shown separately),
  "category": one of ${JSON.stringify(CATEGORIES)} or null (your best guess based on the dish),
  "cuisine": string or null (e.g. "Italian", "Thai" — only if inferable),
  "ingredients": array of strings, each one ingredient line exactly as it appears (e.g. "2 cups flour, sifted"),
  "instructions": array of strings, each one a single step, in order
}

Only include information actually visible in the image. Do not invent or guess ingredient amounts, steps, or times that aren't shown. If the image doesn't contain a recognizable recipe at all, set "title" to null and leave arrays empty.`;

export async function extractRecipeFromImage(
  mediaType: string,
  base64Data: string
): Promise<ExtractedRecipeFromImage> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new VisionExtractionError(
      "Screenshot import isn't set up yet — add ANTHROPIC_API_KEY to your .env file to enable it."
    );
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
              { type: "text", text: "Extract the recipe from this image, following the JSON format exactly." },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new VisionExtractionError("Couldn't reach the extraction service. Check your connection and try again.");
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new VisionExtractionError("The configured ANTHROPIC_API_KEY was rejected. Double-check it in your .env file.");
    }
    const errorBody = await res.json().catch(() => null);
    const detail: string | undefined = errorBody?.error?.message;
    if (detail) {
      throw new VisionExtractionError(`The extraction service rejected this image: ${detail}`);
    }
    throw new VisionExtractionError(`The extraction service returned an error (HTTP ${res.status}).`);
  }

  const json = await res.json();
  const rawText: string | undefined = json?.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!rawText) {
    throw new VisionExtractionError("Didn't get a usable response back. Try again.");
  }

  // The model is instructed to return bare JSON, but strip code fences defensively.
  const cleaned = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new VisionExtractionError("Couldn't read a recipe from that image. Try a clearer or more complete screenshot.");
  }

  const parsed = modelOutputSchema.safeParse(parsedJson);
  if (!parsed.success || !parsed.data.title) {
    throw new VisionExtractionError("Didn't find a recognizable recipe in that image. Try a clearer screenshot, or enter it manually.");
  }
  const data = parsed.data;

  return {
    title: data.title!,
    sourceUrl: null,
    imageUrl: null,
    description: data.description ?? null,
    servings: data.servings ?? null,
    prepMinutes: data.prepMinutes ?? null,
    cookMinutes: data.cookMinutes ?? null,
    totalMinutes: data.totalMinutes ?? null,
    category: data.category ?? null,
    cuisine: data.cuisine ?? null,
    ingredients: (data.ingredients ?? []).map((line) => parseIngredientLine(line)),
    instructions: data.instructions ?? [],
  };
}
const TEXT_SYSTEM_PROMPT = `You extract recipe information from raw text pasted from a recipe website (copied and pasted by the user, so it may include stray navigation text, ads, or comments mixed in — ignore anything that isn't part of the recipe itself).

Respond with ONLY a single JSON object — no markdown code fences, no commentary before or after. It must match exactly this shape:

{
  "title": string or null,
  "description": string or null (a short summary, only if one is actually present in the text),
  "servings": number or null,
  "prepMinutes": number or null (convert any stated prep time to minutes),
  "cookMinutes": number or null (convert any stated cook/bake time to minutes),
  "totalMinutes": number or null (only if the text shows a single combined time rather than a prep/cook split — leave null if prep and cook are shown separately),
  "category": one of ${JSON.stringify(CATEGORIES)} or null (your best guess based on the dish),
  "cuisine": string or null (e.g. "Italian", "Thai" — only if inferable),
  "ingredients": array of strings, each one ingredient line exactly as it appears (e.g. "2 cups flour, sifted"),
  "instructions": array of strings, each one a single step, in order
}

Only include information actually present in the text. Do not invent or guess ingredient amounts, steps, or times that aren't shown. If the text doesn't contain a recognizable recipe at all, set "title" to null and leave arrays empty.`;

export async function extractRecipeFromText(rawText: string): Promise<ExtractedRecipeFromImage> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new VisionExtractionError(
      "Text import isn't set up yet — add ANTHROPIC_API_KEY to your .env file to enable it."
    );
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system: TEXT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract the recipe from this pasted text, following the JSON format exactly:\n\n${rawText}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new VisionExtractionError("Couldn't reach the extraction service. Check your connection and try again.");
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new VisionExtractionError("The configured ANTHROPIC_API_KEY was rejected. Double-check it in your .env file.");
    }
    const errorBody = await res.json().catch(() => null);
    const detail: string | undefined = errorBody?.error?.message;
    if (detail) {
      throw new VisionExtractionError(`The extraction service rejected this text: ${detail}`);
    }
    throw new VisionExtractionError(`The extraction service returned an error (HTTP ${res.status}).`);
  }

  const json = await res.json();
  const responseText: string | undefined = json?.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!responseText) {
    throw new VisionExtractionError("Didn't get a usable response back. Try again.");
  }

  const cleaned = responseText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new VisionExtractionError("Couldn't read a recipe from that text. Try pasting more of the page.");
  }

  const parsed = modelOutputSchema.safeParse(parsedJson);
  if (!parsed.success || !parsed.data.title) {
    throw new VisionExtractionError("Didn't find a recognizable recipe in that text. Try pasting more of the page, or enter it manually.");
  }
  const data = parsed.data;

  return {
    title: data.title!,
    sourceUrl: null,
    imageUrl: null,
    description: data.description ?? null,
    servings: data.servings ?? null,
    prepMinutes: data.prepMinutes ?? null,
    cookMinutes: data.cookMinutes ?? null,
    totalMinutes: data.totalMinutes ?? null,
    category: data.category ?? null,
    cuisine: data.cuisine ?? null,
    ingredients: (data.ingredients ?? []).map((line) => parseIngredientLine(line)),
    instructions: data.instructions ?? [],
  };
}
