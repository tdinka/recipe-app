import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { categoryAndTagsOf } from "@/lib/recipe-extractor";
import { CATEGORIES } from "@/lib/constants";

// Same batching approach as backfill-times — cap per request, UI calls again to continue.
const BATCH_LIMIT = 20;

export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const householdId = session.user.householdId;

  // A recipe is a candidate if it has a category set that ISN'T one of our
  // clean values — that's the signature of an old messy import like
  // "Dinner, Main Course, Poultry" that predates the category/tag split.
  const messyCategoryFilter = {
    householdId,
    category: { not: null, notIn: [...CATEGORIES] },
  };

  const candidates = await db.recipe.findMany({
    where: messyCategoryFilter,
    select: { id: true, title: true, category: true },
    take: BATCH_LIMIT,
  });

  const remainingCount = await db.recipe.count({
    where: { ...messyCategoryFilter, id: { notIn: candidates.map((c) => c.id) } },
  });

  let updated = 0;
  let skipped = 0;

  for (const recipe of candidates) {
    const { category, tags } = categoryAndTagsOf(recipe.category);

    if (!category && tags.length === 0) {
      skipped++;
      continue;
    }

    const tagRecords = await Promise.all(
      tags.map((name) =>
        db.tag.upsert({
          where: { householdId_name: { householdId, name } },
          update: {},
          create: { name, householdId },
        })
      )
    );

    // Avoid creating a duplicate RecipeTag if this tag is already attached
    // (e.g. re-running the backfill, or the recipe already had it by hand).
    const existingTagIds = new Set(
      (
        await db.recipeTag.findMany({
          where: { recipeId: recipe.id },
          select: { tagId: true },
        })
      ).map((rt) => rt.tagId)
    );
    const newTagLinks = tagRecords.filter((t) => !existingTagIds.has(t.id));

    await db.recipe.update({
      where: { id: recipe.id },
      data: {
        category: category ?? null,
        tags: { create: newTagLinks.map((t) => ({ tagId: t.id })) },
      },
    });
    updated++;
  }

  return NextResponse.json({
    checked: candidates.length,
    updated,
    skipped,
    remainingCount,
  });
}
