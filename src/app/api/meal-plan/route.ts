import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const createSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  mealType: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  recipeId: z.string(),
  servings: z.number().int().positive().nullable().optional(),
  scale: z.number().positive().max(20).optional(),
});

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params (YYYY-MM-DD) are required." }, { status: 400 });
  }

  const entries = await db.mealPlanEntry.findMany({
    where: {
      householdId: session.user.householdId,
      date: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
    },
    include: { recipe: { select: { id: true, title: true, imageUrl: true } } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      mealType: e.mealType,
      servings: e.servings,
      scale: e.scale,
      recipe: e.recipe,
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });
  }
  const { date, mealType, recipeId, servings, scale } = parsed.data;
  const householdId = session.user.householdId;

  const recipe = await db.recipe.findFirst({ where: { id: recipeId, householdId } });
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  const entry = await db.mealPlanEntry.create({
    data: {
      date: new Date(`${date}T00:00:00.000Z`),
      mealType,
      recipeId,
      householdId,
      servings: servings ?? null,
      scale: scale ?? 1,
    },
  });

  return NextResponse.json({ id: entry.id }, { status: 201 });
}
