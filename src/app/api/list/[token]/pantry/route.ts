import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdFromToken } from "@/lib/list-auth";
import { guessSection, toNameKey } from "@/lib/grocery";

export const dynamic = "force-dynamic";

const PANTRY_SELECT = { id: true, name: true, section: true } as const;

// One or more items, one per line or separated by commas, e.g. "rice, half a cabbage, limes".
const addSchema = z.object({ text: z.string().trim().min(1).max(1000) });

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });

  const items = await db.pantryItem.findMany({
    where: { householdId: household.id },
    orderBy: { name: "asc" },
    select: PANTRY_SELECT,
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) return NextResponse.json({ error: "List not found." }, { status: 404 });
  const householdId = household.id;

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type something to add." }, { status: 400 });

  // Kept as typed ("2 lb chicken thighs", "half a cabbage"): amounts help when suggesting recipes.
  // Not split on "and", so "mac and cheese" stays one item.
  const names = parsed.data.text
    .split(/\n|,|;/)
    .map((part) => part.trim().replace(/[.!?]+$/, "").slice(0, 120))
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));

  const items = [];
  for (const name of names) {
    const nameKey = toNameKey(name);
    if (!nameKey) continue;
    items.push(
      await db.pantryItem.upsert({
        where: { householdId_nameKey: { householdId, nameKey } },
        update: {},
        create: { name, nameKey, section: guessSection(name), householdId },
        select: PANTRY_SELECT,
      })
    );
  }
  return NextResponse.json({ items }, { status: 201 });
}
