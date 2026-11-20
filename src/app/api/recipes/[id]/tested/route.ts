import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

// "We've cooked it": takes the AI-generated (untested) label off a recipe.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await db.recipe.updateMany({
    where: { id: params.id, householdId: session.user.householdId },
    data: { aiGenerated: false },
  });
  if (result.count === 0) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
