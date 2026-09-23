import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { householdFromToken } from "@/lib/list-auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });

  const items = await db.archivedGroceryItem.findMany({
    where: { householdId: household.id },
    orderBy: [{ timesBought: "desc" }, { lastBoughtAt: "desc" }],
    take: 500,
    select: { id: true, name: true, quantity: true, section: true, store: true, timesBought: true },
  });
  return NextResponse.json({ items });
}
