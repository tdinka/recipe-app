import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const household = await db.household.findUnique({
    where: { id: session.user.householdId },
    select: { name: true, inviteCode: true },
  });
  if (!household) return NextResponse.json({ error: "Household not found." }, { status: 404 });

  return NextResponse.json({ household });
}
