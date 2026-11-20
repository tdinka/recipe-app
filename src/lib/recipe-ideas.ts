import { z } from "zod";
import { addDays, format, parseISO } from "date-fns";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/constants";
import { parseIngredientLines, type ParsedIngredient } from "@/lib/ingredient-parser";

// "What can I make?": recipe ideas from what's in the house, mixing recipes already
// in the box, real recipes found on the web, and a couple Claude writes itself.

export class RecipeIdeasError extends Error {}

export type IdeaKind = "box" | "web" | "ai";

export interface RecipeIdea {
  kind: IdeaKind;
  title: string;
  description: string;
  minutes: number | null;
  uses: string[]; // ingredients from what you have
  toBuy: string[]; // what you'd still need
  recipeId: string | null; // kind "box"
  url: string | null; // kind "web"
  site: string | null; // kind "web", e.g. "budgetbytes.com"
}

// Ideas come in two parts requested at the same time, so the page can show the
// quick ones while the web search is still running:
//   "quick": recipes from the box plus ideas Claude writes (no web search, ~15 seconds)
//   "web":   real recipes found with web search (up to a minute or two)
export type IdeasPart = "quick" | "web";

export interface IdeasRequest {
  householdId: string;
  part: IdeasPart;
  have: string[];
  protein: string | null;
  note: string | null;
  exclude: string[]; // titles already shown, so "New ideas" doesn't repeat them
  weekStart: string | null; // Monday of the current week, YYYY-MM-DD (the meal plan's weeks start on Monday)
}

export interface IdeasResult {
  ideas: RecipeIdea[];
  redMeatDays: number;
  redMeatLimitReached: boolean;
}

const MODEL = "claude-sonnet-5";
const MAX_BOX_RECIPES = 200;
const MAX_SEARCHES = 3;
// Web searches can make the server pause a long turn; resume it at most this many times.
const MAX_RESUMES = 2;
const RED_MEAT_LIMIT_PER_WEEK = 2;

// Sites whose pages the app's link import can't read, or that aren't recipe pages.
const BLOCKED_DOMAINS = [
  "allrecipes.com",
  "nytimes.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "pinterest.com",
  "facebook.com",
  "reddit.com",
];

// Beef, lamb, pork and the like, but not "chicken sausage" or "turkey bacon".
const RED_MEAT =
  /(?<!(?:chicken|turkey|veggie|vegan|plant-based|meatless)\s)\b(beef|steak|brisket|lamb|mutton|goat|pork|bacon|ham|prosciutto|pancetta|chorizo|sausages?|salami|pepperoni|veal|short ribs?|spare ribs?|ribeye|sirloin|carnitas|oxtail|ground chuck|chuck roast|pot roast)\b/i;

export function hasRedMeat(text: string): boolean {
  return RED_MEAT.test(text);
}

// How many different days this week already have a red meat recipe on the meal plan.
async function countRedMeatDays(householdId: string, weekStart: string | null): Promise<number> {
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return 0;
  const start = parseISO(weekStart);
  const end = format(addDays(start, 6), "yyyy-MM-dd");
  const entries = await db.mealPlanEntry.findMany({
    where: {
      householdId,
      date: { gte: new Date(`${weekStart}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
    },
    select: { date: true, recipe: { select: { title: true, ingredientsJson: true } } },
  });
  const days = new Set<string>();
  for (const e of entries) {
    const items = (JSON.parse(e.recipe.ingredientsJson) as ParsedIngredient[]).map((i) => i.item).join(", ");
    if (hasRedMeat(`${e.recipe.title}, ${items}`)) days.add(e.date.toISOString().slice(0, 10));
  }
  return days.size;
}

async function householdPreferences(householdId: string): Promise<string> {
  const h = await db.household.findUnique({
    where: { id: householdId },
    select: {
      prefsWhoEating: true,
      prefsDislikes: true,
      prefsDietGoals: true,
      prefsCookTime: true,
      prefsCuisines: true,
      prefsEquipment: true,
    },
  });
  if (!h) return "";
  return [
    h.prefsWhoEating && `Who's eating: ${h.prefsWhoEating}`,
    h.prefsDislikes && `Dislikes and spice level: ${h.prefsDislikes}`,
    h.prefsDietGoals && `Diet goals: ${h.prefsDietGoals}`,
    h.prefsCookTime && `Cooking time: ${h.prefsCookTime}`,
    h.prefsCuisines && `Cuisines they love: ${h.prefsCuisines}`,
    h.prefsEquipment && `Kitchen equipment: ${h.prefsEquipment}`,
  ]
    .filter(Boolean)
    .join("\n");
}

interface ContentBlock {
  type: string;
  text?: string;
  content?: { url?: string }[] | unknown;
}

// Sends one request to Claude (resuming if web search pauses the turn) and returns
// the final text plus every URL web search actually returned.
async function askClaude(body: Record<string, unknown>, timeoutMs: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new RecipeIdeasError("Recipe ideas need ANTHROPIC_API_KEY to be set.");

  const messages = [...(body.messages as { role: string; content: unknown }[])];
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
        body: JSON.stringify({ model: MODEL, ...body, messages }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new RecipeIdeasError("Couldn't reach the recipe service. Try again.");
    }
    if (!res.ok) {
      const detail = (await res.json().catch(() => null))?.error?.message;
      console.error("recipe ideas error", res.status, detail);
      throw new RecipeIdeasError(`The recipe service returned an error (HTTP ${res.status}). Try again.`);
    }

    const json = await res.json();
    const content: ContentBlock[] = json?.content ?? [];
    for (const block of content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) if (result.url) foundUrls.add(result.url);
      }
    }
    // With web search the answer can arrive split across several text blocks.
    finalText = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");

    if (json?.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content });
  }
  return { text: finalText, foundUrls };
}

// The model is told to return bare JSON; take just the {...} part defensively.
function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const ideasOutputSchema = z.object({
  ideas: z.array(
    z.object({
      kind: z.enum(["box", "web", "ai"]),
      title: z.string(),
      description: z.string().nullable().optional(),
      minutes: z.number().nullable().optional(),
      uses: z.array(z.string()).nullable().optional(),
      toBuy: z.array(z.string()).nullable().optional(),
      recipeId: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
    })
  ),
});

const SHARED_RULES = `Every idea must:
- Mostly use what they have. Assume salt, pepper, cooking oil, butter, garlic, onions, flour, sugar and common dried spices are always on hand.
- Need at most 3 things they'd have to buy, fewer is better.
- Follow their preferences (spice level, diet goals, cooking time, equipment) strictly.
- Be a different dish from the others, and from any titles listed under "Already shown".`;

const OUTPUT_FORMAT = `Respond with ONLY a single JSON object, no markdown code fences, no commentary:

{ "ideas": [ { "kind": KIND, "title": string, "description": string, "minutes": number or null, "uses": [string], "toBuy": [string], "recipeId": string or null, "url": string or null } ] }

"description" is one short, appetizing sentence (under 20 words). "minutes" is the total time. "uses" lists the ingredients from what they have that the dish uses (short names). "toBuy" lists what they'd still need (short names, empty if nothing).`;

const QUICK_SYSTEM_PROMPT = `You help a family decide what to cook for dinner from what they already have at home.

You'll get the family's food preferences, the ingredients they have, sometimes a protein they want to use and a note, and the recipes already saved in their recipe box (as "id | title | category | main ingredients").

Suggest dinner ideas of two kinds:
1. "box": up to 2 recipes from their recipe box that genuinely fit what they have. Only include one if most of its main ingredients are on hand. Use its exact id. It's fine to include none.
2. "ai": exactly 2 original recipes you'd write yourself that make good use of what they have. Make them practical, family-friendly dishes, not gimmicks.

${SHARED_RULES}

${OUTPUT_FORMAT.replace("KIND", '"box" | "ai"')}

"recipeId" is the box recipe's id for "box", null for "ai". "url" is always null.`;

const WEB_SYSTEM_PROMPT = `You help a family decide what to cook for dinner from what they already have at home, by finding real recipes on the web.

You'll get the family's food preferences, the ingredients they have, and sometimes a protein they want to use and a note.

Use web search to find exactly 3 real, well-reviewed recipes that fit. Link each to one specific recipe page (not a search page, roundup, listicle or video), using its exact URL from the search results. Prefer food blogs and recipe sites that publish full recipes with ingredient amounts. Keep searching to a minimum: 1 or 2 well-chosen searches are usually enough.

${SHARED_RULES}

When you're done searching, ${OUTPUT_FORMAT.replace("KIND", '"web"').replace("Respond", "respond")}

"url" is the recipe page's exact URL. "recipeId" is always null.`;

export async function suggestRecipeIdeas(req: IdeasRequest): Promise<IdeasResult> {
  const have = req.have.map((h) => h.trim()).filter(Boolean);
  if (have.length === 0 && !req.protein) {
    throw new RecipeIdeasError("Add at least one ingredient or a protein first.");
  }

  const quick = req.part === "quick";
  const [prefs, redMeatDays, box] = await Promise.all([
    householdPreferences(req.householdId),
    countRedMeatDays(req.householdId, req.weekStart),
    quick
      ? db.recipe.findMany({
          where: { householdId: req.householdId },
          select: { id: true, title: true, category: true, ingredientsJson: true },
          orderBy: { updatedAt: "desc" },
          take: MAX_BOX_RECIPES,
        })
      : Promise.resolve([]),
  ]);
  const redMeatLimitReached = redMeatDays >= RED_MEAT_LIMIT_PER_WEEK;

  const boxList =
    box
      .map((r) => {
        const items = (JSON.parse(r.ingredientsJson) as ParsedIngredient[])
          .map((i) => i.item)
          .slice(0, 10)
          .join(", ");
        return `${r.id} | ${r.title} | ${r.category ?? ""} | ${items}`;
      })
      .join("\n") || "(empty)";

  const redMeatRule = redMeatLimitReached
    ? `Red meat: the family limits red meat to ${RED_MEAT_LIMIT_PER_WEEK} days a week and this week's meal plan already has ${redMeatDays}. Do NOT suggest anything with beef, lamb, pork, ham, bacon, sausage or other red meat, even if they have it.`
    : `Red meat: the family limits red meat to ${RED_MEAT_LIMIT_PER_WEEK} days a week; this week's meal plan has ${redMeatDays} so far. Favor poultry, fish, eggs, beans and vegetables, with at most 1 red meat idea.`;

  const userMessage = [
    prefs ? `Food preferences:\n${prefs}` : "Food preferences: none given.",
    redMeatRule,
    `Ingredients they have:\n${have.length ? have.join(", ") : "(only the basics)"}`,
    req.protein && `Protein they want to use: ${req.protein}`,
    req.note && `Note: ${req.note}`,
    req.exclude.length > 0 && `Already shown (suggest different dishes):\n${req.exclude.join("\n")}`,
    quick && `Recipes in the family's recipe box:\n${boxList}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text, foundUrls } = await askClaude(
    quick
      ? {
          max_tokens: 3000,
          system: QUICK_SYSTEM_PROMPT,
          output_config: { effort: "medium" },
          messages: [{ role: "user", content: userMessage }],
        }
      : {
          max_tokens: 4000,
          system: WEB_SYSTEM_PROMPT,
          output_config: { effort: "low" },
          tools: [
            { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES, blocked_domains: BLOCKED_DOMAINS },
          ],
          messages: [{ role: "user", content: userMessage }],
        },
    quick ? 60000 : 150000
  );

  const parsed = ideasOutputSchema.safeParse(parseJsonObject(text));
  if (!parsed.success) throw new RecipeIdeasError("Didn't get usable ideas back. Try again.");

  const boxById = new Map(box.map((r) => [r.id, r]));
  const seen = new Set(req.exclude.map((t) => t.trim().toLowerCase()));
  const ideas: RecipeIdea[] = [];

  for (const raw of parsed.data.ideas) {
    const title = raw.title.trim().slice(0, 120);
    if (!title || seen.has(title.toLowerCase())) continue;
    const base = {
      title,
      description: (raw.description ?? "").trim().slice(0, 200),
      minutes: raw.minutes && raw.minutes > 0 ? Math.round(raw.minutes) : null,
      uses: (raw.uses ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 12),
      toBuy: (raw.toBuy ?? []).map((u) => u.trim()).filter(Boolean).slice(0, 6),
    };

    // Never show a link that isn't really in the box or didn't really come back from the search.
    if (raw.kind === "web" && quick) continue;
    if (raw.kind !== "web" && !quick) continue;
    if (raw.kind === "box") {
      const recipe = raw.recipeId ? boxById.get(raw.recipeId) : undefined;
      if (!recipe) continue;
      ideas.push({ ...base, kind: "box", title: recipe.title, recipeId: recipe.id, url: null, site: null });
    } else if (raw.kind === "web") {
      if (!raw.url || !foundUrls.has(raw.url)) continue;
      let site: string | null = null;
      try {
        site = new URL(raw.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      ideas.push({ ...base, kind: "web", recipeId: null, url: raw.url, site });
    } else {
      ideas.push({ ...base, kind: "ai", recipeId: null, url: null, site: null });
    }
    seen.add(title.toLowerCase());
  }

  // Safety net for the red meat limit, in case the model slips.
  const filtered = redMeatLimitReached
    ? ideas.filter((i) => !hasRedMeat(`${i.title} ${i.description} ${i.uses.join(" ")} ${i.toBuy.join(" ")}`))
    : ideas;

  if (filtered.length === 0) {
    throw new RecipeIdeasError(quick ? "Didn't get usable ideas back. Try again." : "Couldn't find matching recipes on the web this time.");
  }

  // Box recipes first, then web, then AI.
  const order: Record<IdeaKind, number> = { box: 0, web: 1, ai: 2 };
  filtered.sort((a, b) => order[a.kind] - order[b.kind]);
  return { ideas: filtered.slice(0, 4), redMeatDays, redMeatLimitReached };
}

// ---------- Writing out a full recipe for an "ai" idea ----------

export interface WrittenRecipe {
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
  tags: string[];
  ingredients: ParsedIngredient[];
  instructions: string[];
}

const writtenOutputSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  servings: z.number().nullable().optional(),
  prepMinutes: z.number().nullable().optional(),
  cookMinutes: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
});

const WRITE_SYSTEM_PROMPT = `You write complete, reliable home-cooking recipes for a family, from a short idea.

Write it the way a careful recipe developer would: exact amounts in US measurements, realistic times, clear steps a home cook can follow, with doneness cues (e.g. "until the chicken reaches 165°F"). Follow the family's preferences strictly (spice level, diet goals, cooking time, equipment). Use the ingredients they have where it makes sense.

Respond with ONLY a single JSON object, no markdown code fences, no commentary:

{
  "title": string,
  "description": string (one or two appetizing sentences),
  "servings": number,
  "prepMinutes": number,
  "cookMinutes": number,
  "category": one of ${JSON.stringify(CATEGORIES)},
  "cuisine": string or null,
  "tags": [string] (2 to 4 short tags, e.g. "weeknight", "one-pan"),
  "ingredients": [string] (one ingredient line each, with amounts, e.g. "1 1/2 lb boneless chicken thighs". If the recipe has parts, put a heading ending in a colon on its own line before that part, e.g. "For the sauce:"),
  "instructions": [string] (one step each, in order)
}`;

export async function writeIdeaRecipe(input: {
  householdId: string;
  title: string;
  description: string | null;
  uses: string[];
  toBuy: string[];
}): Promise<WrittenRecipe> {
  const prefs = await householdPreferences(input.householdId);
  const userMessage = [
    prefs ? `Food preferences:\n${prefs}` : null,
    `Recipe idea: ${input.title}`,
    input.description && `Idea description: ${input.description}`,
    input.uses.length > 0 && `Ingredients they have to use: ${input.uses.join(", ")}`,
    input.toBuy.length > 0 && `Planned extra ingredients to buy: ${input.toBuy.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text } = await askClaude(
    {
      max_tokens: 4000,
      system: WRITE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    },
    90000
  );

  const parsed = writtenOutputSchema.safeParse(parseJsonObject(text));
  if (!parsed.success || parsed.data.ingredients.length === 0 || parsed.data.instructions.length === 0) {
    throw new RecipeIdeasError("Couldn't write that recipe out. Try again.");
  }
  const d = parsed.data;
  const category = d.category && (CATEGORIES as readonly string[]).includes(d.category) ? d.category : "Dinner";
  const prep = d.prepMinutes && d.prepMinutes > 0 ? Math.round(d.prepMinutes) : null;
  const cook = d.cookMinutes && d.cookMinutes > 0 ? Math.round(d.cookMinutes) : null;

  return {
    title: d.title.trim().slice(0, 200),
    sourceUrl: null,
    imageUrl: null,
    description: d.description?.trim() || null,
    servings: d.servings && d.servings > 0 ? Math.round(d.servings) : null,
    prepMinutes: prep,
    cookMinutes: cook,
    totalMinutes: null,
    category,
    cuisine: d.cuisine?.trim() || null,
    tags: (d.tags ?? []).map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 40).slice(0, 4),
    ingredients: parseIngredientLines(d.ingredients.join("\n")),
    instructions: d.instructions.map((s) => s.trim()).filter(Boolean),
  };
}
