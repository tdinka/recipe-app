import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const patchSchema = z.object({ checked: z.boolean() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const item = await db.groceryItem.findFirst({
    where: { id: params.id, householdId: session.user.householdId },
  });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data." }, { status: 400 });

  await db.groceryItem.update({ where: { id: item.id }, data: { checked: parsed.data.checked } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const item = await db.groceryItem.findFirst({
    where: { id: params.id, householdId: session.user.householdId },
  });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.groceryItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
