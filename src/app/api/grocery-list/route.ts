import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { scaleQuantityText } from "@/lib/scale-quantity";
import type { ParsedIngredient } from "@/lib/ingredient-parser";

const manualItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.string().max(60).nullable().optional(),
});

const generateSchema = z.object({
  generateFrom: z.object({
    start: z.string(), // YYYY-MM-DD
    end: z.string(),
  }),
});

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const items = await db.groceryItem.findMany({
    where: { householdId: session.user.householdId },
    orderBy: [{ checked: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const householdId = session.user.householdId;

  const body = await req.json().catch(() => null);

  const generateParsed = generateSchema.safeParse(body);
  if (generateParsed.success) {
    const { start, end } = generateParsed.data.generateFrom;

    const entries = await db.mealPlanEntry.findMany({
      where: {
        householdId,
        date: { gte: new Date(`${start}T00:00:00.000Z`), lte: new Date(`${end}T23:59:59.999Z`) },
      },
      include: { recipe: true },
    });

    // Aggregate ingredients across all planned meals, grouping by item name (case-insensitive),
    // scaling each recipe's quantities by that meal plan entry's chosen serving multiplier.
    const grouped = new Map<string, { name: string; quantities: string[] }>();
    for (const entry of entries) {
      const ingredients: ParsedIngredient[] = JSON.parse(entry.recipe.ingredientsJson);
      for (const ing of ingredients) {
        const key = ing.item.toLowerCase().trim();
        if (!key) continue;
        const scaledQuantity = ing.quantity ? scaleQuantityText(ing.quantity, entry.scale) : ing.quantity;
        const label = [scaledQuantity, ing.unit].filter(Boolean).join(" ").trim();
        if (!grouped.has(key)) {
          grouped.set(key, { name: ing.item.trim(), quantities: label ? [label] : [] });
        } else if (label) {
          grouped.get(key)!.quantities.push(label);
        }
      }
    }

    // Replace previously auto-generated items, but leave manually added ones untouched.
    await db.groceryItem.deleteMany({ where: { householdId, source: "generated" } });

    if (grouped.size > 0) {
      await db.groceryItem.createMany({
        data: Array.from(grouped.values()).map((g) => ({
          name: g.name,
          quantity: g.quantities.length ? g.quantities.join(" + ") : null,
          householdId,
          source: "generated",
        })),
      });
    }

    const items = await db.groceryItem.findMany({
      where: { householdId },
      orderBy: [{ checked: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ items });
  }

  const manualParsed = manualItemSchema.safeParse(body);
  if (!manualParsed.success) {
    return NextResponse.json({ error: "Invalid grocery item." }, { status: 400 });
  }
  const item = await db.groceryItem.create({
    data: {
      name: manualParsed.data.name,
      quantity: manualParsed.data.quantity || null,
      householdId,
      source: "manual",
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE() {
  // Clears every checked-off item — a "tidy up the list" action.
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await db.groceryItem.deleteMany({ where: { householdId: session.user.householdId, checked: true } });
  return NextResponse.json({ ok: true });
}
