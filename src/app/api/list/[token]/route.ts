import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdFromToken, ITEM_SELECT } from "@/lib/list-auth";
import { DEFAULT_STORE, SECTIONS, STORE_IDS, guessSection } from "@/lib/grocery";
import { addGroceryItem } from "@/lib/grocery-add";

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

  const { item, merged } = await addGroceryItem(householdId, { name, quantity, store, section });
  return NextResponse.json(merged ? { item, merged } : { item }, { status: merged ? 200 : 201 });
}
