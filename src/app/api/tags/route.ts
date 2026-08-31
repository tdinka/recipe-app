import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const tags = await db.tag.findMany({
    where: { householdId: session.user.householdId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tags: tags.map((t) => t.name) });
}
