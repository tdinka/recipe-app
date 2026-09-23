import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdFromToken, ITEM_SELECT } from "@/lib/list-auth";
import { SECTIONS, STORE_IDS, toNameKey } from "@/lib/grocery";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  quantity: z.string().trim().max(60).nullable().optional(),
  store: z.enum(STORE_IDS).optional(),
  section: z.enum(SECTIONS).optional(),
});

type Params = { params: { token: string; id: string } };

async function findItem({ params }: Params) {
  const household = await householdFromToken(params.token);
  if (!household) return null;
  return db.groceryItem.findFirst({ where: { id: params.id, householdId: household.id } });
}

export async function PATCH(req: Request, ctx: Params) {
  const item = await findItem(ctx);
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data." }, { status: 400 });

  const { quantity, ...rest } = parsed.data;
  const updated = await db.groceryItem.update({
    where: { id: item.id },
    data: { ...rest, ...(quantity !== undefined ? { quantity: quantity || null } : {}) },
    select: ITEM_SELECT,
  });

  // Remember a hand-corrected section for next time this item is added.
  if (parsed.data.section) {
    await db.archivedGroceryItem.updateMany({
      where: { householdId: item.householdId, nameKey: toNameKey(updated.name) },
      data: { section: parsed.data.section },
    });
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: Request, ctx: Params) {
  const item = await findItem(ctx);
  if (!item) return NextResponse.json({ ok: true });
  await db.groceryItem.deleteMany({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
