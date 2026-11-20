import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

// The pantry for the signed-in household (used by "What can I make?").
// The family list link edits it through /api/list/[token]/pantry.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const items = await db.pantryItem.findMany({
    where: { householdId: session.user.householdId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, section: true },
  });
  return NextResponse.json({ items });
}
