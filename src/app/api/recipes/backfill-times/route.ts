import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { extractRecipeFromUrl } from "@/lib/recipe-extractor";

// Cap per request so this stays well within a reasonable response time even
// on a household with a big collection — the UI can just call it again to
// keep going, and each call reports how many are left.
const BATCH_LIMIT = 20;

export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const householdId = session.user.householdId;

  // Only recipes that have a link to retry AND are missing every time field —
  // if any time field is already set (imported or edited by hand), leave it alone.
  const candidates = await db.recipe.findMany({
    where: {
      householdId,
      sourceUrl: { not: null },
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
    },
    select: { id: true, title: true, sourceUrl: true },
    take: BATCH_LIMIT,
  });

  const remainingCount = await db.recipe.count({
    where: {
      householdId,
      sourceUrl: { not: null },
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      id: { notIn: candidates.map((c) => c.id) },
    },
  });

  let updated = 0;
  let stillMissing = 0;
  let failed = 0;
  const failedTitles: string[] = [];

  for (const recipe of candidates) {
    try {
      const extracted = await extractRecipeFromUrl(recipe.sourceUrl!);
      if (extracted.prepMinutes || extracted.cookMinutes || extracted.totalMinutes) {
        await db.recipe.update({
          where: { id: recipe.id },
          data: {
            prepMinutes: extracted.prepMinutes,
            cookMinutes: extracted.cookMinutes,
            totalMinutes: extracted.totalMinutes,
          },
        });
        updated++;
      } else {
        stillMissing++;
      }
    } catch {
      failed++;
      failedTitles.push(recipe.title);
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    updated,
    stillMissing,
    failed,
    failedTitles,
    remainingCount,
  });
}
