import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const entry = await db.mealPlanEntry.findFirst({
    where: { id: params.id, householdId: session.user.householdId },
  });
  if (!entry) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.mealPlanEntry.delete({ where: { id: entry.id } });
  return NextResponse.json({ ok: true });
}
