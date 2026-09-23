import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdFromToken, ITEM_SELECT } from "@/lib/list-auth";
import { DEFAULT_STORE, SECTIONS, STORE_IDS, combineQuantities, guessSection, toNameKey } from "@/lib/grocery";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().max(60).nullable().optional(),
  store: z.enum(STORE_IDS).optional(),
  section: z.enum(SECTIONS).optional(),
});

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });

  const items = await db.groceryItem.findMany({
    where: { householdId: household.id, checked: false },
    orderBy: { createdAt: "asc" },
    select: ITEM_SELECT,
  });

  // Give "Other" items another try with the sorter (e.g. items carried over from
  // the old list, which all started out as "Other").
  for (const item of items) {
    if (item.section !== "Other") continue;
    const guess = guessSection(item.name);
    if (guess === "Other") continue;
    item.section = guess;
    await db.groceryItem.update({ where: { id: item.id }, data: { section: guess } });
  }

  return NextResponse.json({ items });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });
  const householdId = household.id;

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  const { name, quantity, store = DEFAULT_STORE, section } = parsed.data;

  // Already on the list for this store? Combine quantities instead of adding a second line.
  const existing = await db.groceryItem.findFirst({
    where: { householdId, checked: false, store, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    const item = await db.groceryItem.update({
      where: { id: existing.id },
      data: { quantity: combineQuantities(existing.quantity, quantity ?? null) },
      select: ITEM_SELECT,
    });
    return NextResponse.json({ item, merged: true });
  }

  // Reuse the section from the last time this was bought (it may have been corrected by hand).
  const past = section
    ? null
    : await db.archivedGroceryItem.findUnique({
        where: { householdId_nameKey: { householdId, nameKey: toNameKey(name) } },
        select: { section: true },
      });

  const item = await db.groceryItem.create({
    data: {
      name,
      quantity: quantity || null,
      store,
      section: section ?? (past && past.section !== "Other" ? past.section : guessSection(name)),
      householdId,
      source: "manual",
    },
    select: ITEM_SELECT,
  });
  return NextResponse.json({ item }, { status: 201 });
}
