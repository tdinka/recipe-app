import { z } from "zod";
import { db } from "@/lib/db";
import type { ParsedIngredient } from "@/lib/ingredient-parser";

// One thing to serve with a recipe. recipeId is set when it's another recipe in
// the box; url when it's a recipe found on the web.
export interface ServingSuggestion {
  text: string;
  recipeId?: string | null;
  url?: string | null;
}

export class ServingSuggestionError extends Error {}

const MAX_BOX_RECIPES = 300;
const MAX_SEARCHES = 3;
// Web searches can make the server pause a long turn; resume it at most this many times.
const MAX_RESUMES = 2;

const modelOutputSchema = z.object({
  suggestions: z.array(z.object({ text: z.string(), recipeId: z.string().nullable().optional(), url: z.string().nullable().optional() })),
});

const SYSTEM_PROMPT = `You suggest what to serve alongside a home-cooked dish: sides, salads, breads, drinks, garnishes or toppings that go well with it.

You'll get the dish, plus a list of recipes already in the family's recipe box (as "id | title | category"). When one of those recipes would go well with the dish, prefer it and include its id. Never suggest the dish itself.

Also use web search to find 1 or 2 well-reviewed recipes on the web for sides that would pair well and aren't already in the box. Link to a specific recipe page (not a search page, roundup or video), using its exact URL from the search results.

When you're done searching, respond with ONLY a single JSON object, no markdown code fences, no commentary:

{ "suggestions": [ { "text": string, "recipeId": string or null, "url": string or null } ] }

Give 4 or 5 suggestions in total. Keep each "text" short and practical (under 12 words), e.g. "Steamed jasmine rice to soak up the sauce" or "Simple green salad with lemon vinaigrette". For a recipe-box match, "text" should name that recipe and "url" is null. For a web recipe, "text" should name the dish and "recipeId" is null. Use only ids from the list.`;

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

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: `${dish}\n\nRecipes in the family's recipe box:\n${boxList}` },
  ];
  const foundUrls = new Set<string>();
  let finalText = "";

  for (let attempt = 0; attempt <= MAX_RESUMES; attempt++) {
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
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }],
          messages,
        }),
        signal: AbortSignal.timeout(90000),
      });
    } catch {
      throw new ServingSuggestionError("Couldn't reach the suggestion service. Try again.");
    }
    if (!res.ok) throw new ServingSuggestionError(`The suggestion service returned an error (HTTP ${res.status}).`);

    const json = await res.json();
    const content: ContentBlock[] = json?.content ?? [];
    for (const block of content) {
      // Remember every page web search actually returned, so we never show a made-up link.
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) if (result.url) foundUrls.add(result.url);
      }
    }
    // With web search the answer can arrive split across several text blocks.
    finalText = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");

    if (json?.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content });
  }

  // The model is instructed to return bare JSON, but take just the {...} part defensively.
  const start = finalText.indexOf("{");
  const end = finalText.lastIndexOf("}");
  let parsed;
  try {
    parsed = modelOutputSchema.safeParse(JSON.parse(finalText.slice(start, end + 1)));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) throw new ServingSuggestionError("Didn't get usable suggestions back. Try again.");

  // Only keep links to recipes that really are in this household's box, or pages
  // that really came back from the search.
  const boxIds = new Set(box.map((r) => r.id));
  return parsed.data.suggestions
    .map((s) => {
      const recipeId = s.recipeId && boxIds.has(s.recipeId) ? s.recipeId : null;
      const url = !recipeId && s.url && foundUrls.has(s.url) ? s.url : null;
      return { text: s.text.trim().slice(0, 120), recipeId, url };
    })
    .filter((s) => s.text)
    .slice(0, 6);
}

interface ContentBlock {
  type: string;
  text?: string;
  content?: { url?: string }[] | unknown;
}
