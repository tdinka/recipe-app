import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { RecipeIdeasError, suggestRecipeIdeas } from "@/lib/recipe-ideas";

export const dynamic = "force-dynamic";
// A batch includes web searches and can take up to a minute or two.
export const maxDuration = 300;

const schema = z.object({
  part: z.enum(["quick", "web"]),
  have: z.array(z.string().trim().max(120)).max(100).default([]),
  protein: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  exclude: z.array(z.string().trim().max(200)).max(60).default([]),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Something about that request wasn't right." }, { status: 400 });
  const d = parsed.data;

  try {
    const result = await suggestRecipeIdeas({
      householdId: session.user.householdId,
      part: d.part,
      have: d.have,
      protein: d.protein || null,
      note: d.note || null,
      exclude: d.exclude,
      weekStart: d.weekStart ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof RecipeIdeasError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong getting ideas. Try again." }, { status: 500 });
  }
}
