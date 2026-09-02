import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  const householdId = (session?.user as any)?.householdId;

  if (!householdId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const household = await db.household.findUnique({
    where: { id: householdId },
    select: { shareEnabled: true, shareToken: true },
  });

  if (!household) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(household);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const householdId = (session?.user as any)?.householdId;

  if (!householdId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json();

  const data: { shareEnabled?: boolean; shareToken?: string } = {};
  if (action === "enable") data.shareEnabled = true;
  if (action === "disable") data.shareEnabled = false;
  if (action === "regenerate") data.shareToken = randomUUID();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const household = await db.household.update({
    where: { id: householdId },
    data,
  });

  return NextResponse.json({
    shareEnabled: household.shareEnabled,
    shareToken: household.shareToken,
  });
}
