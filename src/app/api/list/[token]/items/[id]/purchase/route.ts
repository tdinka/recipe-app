import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { householdFromToken } from "@/lib/list-auth";
import { toNameKey } from "@/lib/grocery";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { token: string; id: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });
  const householdId = household.id;

  const item = await db.groceryItem.findFirst({ where: { id: params.id, householdId } });
  // Already bought (maybe from someone else's phone), so there's nothing to do.
  if (!item) return NextResponse.json({ ok: true });

  const nameKey = toNameKey(item.name);
  await db.$transaction([
    db.archivedGroceryItem.upsert({
      where: { householdId_nameKey: { householdId, nameKey } },
      create: {
        name: item.name,
        nameKey,
        quantity: item.quantity,
        section: item.section,
        store: item.store,
        householdId,
      },
      update: {
        name: item.name,
        quantity: item.quantity,
        section: item.section,
        store: item.store,
        timesBought: { increment: 1 },
        lastBoughtAt: new Date(),
      },
    }),
    db.groceryItem.deleteMany({ where: { id: item.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
