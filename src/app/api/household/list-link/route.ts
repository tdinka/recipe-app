import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

function newToken() {
  return randomBytes(18).toString("base64url");
}

// Returns the family list link token, creating one the first time.
export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const householdId = session.user.householdId;

  const household = await db.household.findUnique({ where: { id: householdId }, select: { listToken: true } });
  if (!household) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let token = household.listToken;
  if (!token) {
    token = newToken();
    await db.household.update({ where: { id: householdId }, data: { listToken: token } });
  }
  return NextResponse.json({ token });
}

// Resets the link. The old link stops working immediately.
export async function POST() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const token = newToken();
  await db.household.update({ where: { id: session.user.householdId }, data: { listToken: token } });
  return NextResponse.json({ token });
}
