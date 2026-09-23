import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { householdFromToken } from "@/lib/list-auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { token: string; id: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });
  await db.archivedGroceryItem.deleteMany({ where: { id: params.id, householdId: household.id } });
  return NextResponse.json({ ok: true });
}
