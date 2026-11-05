import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { generateServingSuggestions, ServingSuggestionError, type ServingSuggestion } from "@/lib/serving-suggestions";

// POST: ask Claude for fresh suggestions and save them.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const recipe = await db.recipe.findFirst({ where: { id: params.id, householdId: session.user.householdId } });
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  try {
    const suggestions = await generateServingSuggestions(recipe);
    await db.recipe.update({ where: { id: recipe.id }, data: { servingSuggestionsJson: JSON.stringify(suggestions) } });
    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof ServingSuggestionError ? err.message : "Couldn't come up with suggestions. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

const editSchema = z.object({ lines: z.array(z.string().max(120)).max(10) });

// PUT: save a hand-edited list (one suggestion per line). Lines that weren't
// changed keep their link to a recipe in the box.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const recipe = await db.recipe.findFirst({
    where: { id: params.id, householdId: session.user.householdId },
    select: { id: true, servingSuggestionsJson: true },
  });
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid suggestions." }, { status: 400 });

  const previous: ServingSuggestion[] = recipe.servingSuggestionsJson ? JSON.parse(recipe.servingSuggestionsJson) : [];
  const suggestions = parsed.data.lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text, recipeId: previous.find((p) => p.text === text)?.recipeId ?? null }));

  await db.recipe.update({ where: { id: recipe.id }, data: { servingSuggestionsJson: JSON.stringify(suggestions) } });
  return NextResponse.json({ suggestions });
}
