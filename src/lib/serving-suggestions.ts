import { z } from "zod";
import { db } from "@/lib/db";
import type { ParsedIngredient } from "@/lib/ingredient-parser";

// One thing to serve with a recipe. recipeId is set when it's another recipe in the box.
export interface ServingSuggestion {
  text: string;
  recipeId?: string | null;
}

export class ServingSuggestionError extends Error {}

const MAX_BOX_RECIPES = 300;

const modelOutputSchema = z.object({
  suggestions: z.array(z.object({ text: z.string(), recipeId: z.string().nullable().optional() })),
});

const SYSTEM_PROMPT = `You suggest what to serve alongside a home-cooked dish: sides, salads, breads, drinks, garnishes or toppings that go well with it.

You'll get the dish, plus a list of recipes already in the family's recipe box (as "id | title | category"). When one of those recipes would go well with the dish, prefer it and include its id. Never suggest the dish itself.

Respond with ONLY a single JSON object, no markdown code fences, no commentary:

{ "suggestions": [ { "text": string, "recipeId": string or null } ] }

Give 3 or 4 suggestions. Keep each "text" short and practical (under 12 words), e.g. "Steamed jasmine rice to soak up the sauce" or "Simple green salad with lemon vinaigrette". For a recipe-box match, "text" should name that recipe. Use only ids from the list; otherwise set "recipeId" to null.`;

export async function generateServingSuggestions(recipe: {
  id: string;
  householdId: string;
  title: string;
  description: string | null;
  category: string | null;
  cuisine: string | null;
  ingredientsJson: string;
}): Promise<ServingSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ServingSuggestionError("Serving suggestions need ANTHROPIC_API_KEY to be set.");

  const box = await db.recipe.findMany({
    where: { householdId: recipe.householdId, id: { not: recipe.id } },
    select: { id: true, title: true, category: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_BOX_RECIPES,
  });

  const ingredients = (JSON.parse(recipe.ingredientsJson) as ParsedIngredient[]).map((i) => i.item).join(", ");
  const dish = [
    `Dish: ${recipe.title}`,
    recipe.description && `Description: ${recipe.description}`,
    recipe.category && `Category: ${recipe.category}`,
    recipe.cuisine && `Cuisine: ${recipe.cuisine}`,
    ingredients && `Main ingredients: ${ingredients}`,
  ]
    .filter(Boolean)
    .join("\n");
  const boxList = box.map((r) => `${r.id} | ${r.title} | ${r.category ?? ""}`).join("\n") || "(empty)";

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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `${dish}\n\nRecipes in the family's recipe box:\n${boxList}` }],
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ServingSuggestionError("Couldn't reach the suggestion service. Try again.");
  }
  if (!res.ok) throw new ServingSuggestionError(`The suggestion service returned an error (HTTP ${res.status}).`);

  const json = await res.json();
  const rawText: string | undefined = json?.content?.find((b: { type: string }) => b.type === "text")?.text;
  // The model is instructed to return bare JSON, but strip code fences defensively.
  const cleaned = (rawText ?? "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  let parsed;
  try {
    parsed = modelOutputSchema.safeParse(JSON.parse(cleaned));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) throw new ServingSuggestionError("Didn't get usable suggestions back. Try again.");

  // Only keep links to recipes that really are in this household's box.
  const boxIds = new Set(box.map((r) => r.id));
  return parsed.data.suggestions
    .map((s) => ({ text: s.text.trim().slice(0, 120), recipeId: s.recipeId && boxIds.has(s.recipeId) ? s.recipeId : null }))
    .filter((s) => s.text)
    .slice(0, 5);
}
