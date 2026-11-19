import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const PREFS_SELECT = {
  prefsWhoEating: true,
  prefsDislikes: true,
  prefsDietGoals: true,
  prefsCookTime: true,
  prefsCuisines: true,
  prefsEquipment: true,
} as const;

const field = z.string().trim().max(500).nullable().optional();
const prefsSchema = z.object({
  prefsWhoEating: field,
  prefsDislikes: field,
  prefsDietGoals: field,
  prefsCookTime: field,
  prefsCuisines: field,
  prefsEquipment: field,
});

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const prefs = await db.household.findUnique({ where: { id: session.user.householdId }, select: PREFS_SELECT });
  if (!prefs) return NextResponse.json({ error: "Household not found." }, { status: 404 });
  return NextResponse.json({ prefs });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = prefsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Each answer can be up to 500 characters." }, { status: 400 });

  // Empty boxes are saved as "not set".
  const data = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v ? v : null]));
  const prefs = await db.household.update({
    where: { id: session.user.householdId },
    data,
    select: PREFS_SELECT,
  });
  return NextResponse.json({ prefs });
}
