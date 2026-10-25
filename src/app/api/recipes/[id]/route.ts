import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const ingredientSchema = z.object({
  raw: z.string(),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  item: z.string(),
  group: z.string().max(80).nullable().optional(),
});

const recipeInputSchema = z.object({
  title: z.string().min(1).max(200),
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

async function loadOwnedRecipe(id: string, householdId: string) {
  const recipe = await db.recipe.findFirst({
    where: { id, householdId },
    include: { tags: { include: { tag: true } } },
  });
  return recipe;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const recipe = await loadOwnedRecipe(params.id, session.user.householdId);
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  return NextResponse.json({
    recipe: {
      id: recipe.id,
      title: recipe.title,
      sourceUrl: recipe.sourceUrl,
      imageUrl: recipe.imageUrl,
      imageAttributionName: recipe.imageAttributionName,
      imageAttributionUrl: recipe.imageAttributionUrl,
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.totalMinutes,
      category: recipe.category,
      cuisine: recipe.cuisine,
      ingredients: JSON.parse(recipe.ingredientsJson),
      instructions: JSON.parse(recipe.instructionsJson),
      tags: recipe.tags.map((t) => t.tag.name),
      createdAt: recipe.createdAt,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const existing = await loadOwnedRecipe(params.id, session.user.householdId);
  if (!existing) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = recipeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid recipe data." }, { status: 400 });
  }
  const data = parsed.data;
  const householdId = session.user.householdId;

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

  await db.recipeTag.deleteMany({ where: { recipeId: existing.id } });
  await db.recipe.update({
    where: { id: existing.id },
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
      tags: { create: tagRecords.map((t) => ({ tagId: t.id })) },
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const existing = await loadOwnedRecipe(params.id, session.user.householdId);
  if (!existing) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  await db.recipe.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
