import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const ingredientSchema = z.object({
  raw: z.string(),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  item: z.string(),
});

const recipeInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  sourceUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal("")),
  imageAttributionName: z.string().nullable().optional(),
  imageAttributionUrl: z.string().url().nullable().optional().or(z.literal("")),
  description: z.string().nullable().optional(),
  servings: z.number().int().positive().nullable().optional(),
  prepMinutes: z.number().int().nonnegative().nullable().optional(),
  cookMinutes: z.number().int().nonnegative().nullable().optional(),
  totalMinutes: z.number().int().nonnegative().nullable().optional(),
  category: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).default([]),
  instructions: z.array(z.string()).default([]),
  tags: z.array(z.string().min(1).max(40)).default([]),
});

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const tag = searchParams.get("tag");
  const q = searchParams.get("q");

  const recipes = await db.recipe.findMany({
    where: {
      householdId: session.user.householdId,
      ...(category ? { category } : {}),
      ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.imageUrl,
      category: r.category,
      cuisine: r.cuisine,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      totalMinutes: r.totalMinutes,
      servings: r.servings,
      tags: r.tags.map((t) => t.tag.name),
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = recipeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid recipe data." }, { status: 400 });
  }
  const data = parsed.data;
  const householdId = session.user.householdId;

  // Resolve tag names to Tag rows scoped to this household, creating any that don't exist yet.
  const tagNames = Array.from(new Set(data.tags.map((t) => t.trim()).filter(Boolean)));
  const tagRecords = await Promise.all(
    tagNames.map((name) =>
      db.tag.upsert({
        where: { householdId_name: { householdId, name } },
        update: {},
        create: { name, householdId },
      })
    )
  );

  const recipe = await db.recipe.create({
    data: {
      title: data.title,
      sourceUrl: data.sourceUrl || null,
      imageUrl: data.imageUrl || null,
      imageAttributionName: data.imageAttributionName || null,
      imageAttributionUrl: data.imageAttributionUrl || null,
      description: data.description || null,
      servings: data.servings ?? null,
      prepMinutes: data.prepMinutes ?? null,
      cookMinutes: data.cookMinutes ?? null,
      totalMinutes: data.totalMinutes ?? null,
      category: data.category || null,
      cuisine: data.cuisine || null,
      ingredientsJson: JSON.stringify(data.ingredients),
      instructionsJson: JSON.stringify(data.instructions),
      householdId,
      tags: { create: tagRecords.map((t) => ({ tagId: t.id })) },
    },
  });

  return NextResponse.json({ id: recipe.id }, { status: 201 });
}
