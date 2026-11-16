import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const pinSchema = z.object({ pinned: z.boolean() });

// Pins a recipe to the top of the recipe box, or unpins it.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = pinSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { count } = await db.recipe.updateMany({
    where: { id: params.id, householdId: session.user.householdId },
    data: { pinnedAt: parsed.data.pinned ? new Date() : null },
  });
  if (count === 0) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  return NextResponse.json({ pinned: parsed.data.pinned });
}
