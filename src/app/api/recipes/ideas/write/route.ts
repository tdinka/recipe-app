import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { RecipeIdeasError, writeIdeaRecipe } from "@/lib/recipe-ideas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(400).nullable().optional(),
  uses: z.array(z.string().trim().max(120)).max(30).default([]),
  toBuy: z.array(z.string().trim().max(120)).max(15).default([]),
});

// Writes out the full recipe for an AI idea, for the review screen.
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something about that request wasn't right." }, { status: 400 });

  try {
    const recipe = await writeIdeaRecipe({ householdId: session.user.householdId, ...parsed.data, description: parsed.data.description ?? null });
    return NextResponse.json({ recipe });
  } catch (err) {
    if (err instanceof RecipeIdeasError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong writing that recipe. Try again." }, { status: 500 });
  }
}
