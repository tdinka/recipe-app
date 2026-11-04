import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const notesSchema = z.object({ notes: z.string().max(5000) });

// Saves just the notes, so editing them never touches the rest of the recipe.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = notesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Notes are too long." }, { status: 400 });

  const notes = parsed.data.notes.trim() || null;
  const { count } = await db.recipe.updateMany({
    where: { id: params.id, householdId: session.user.householdId },
    data: { notes },
  });
  if (count === 0) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });

  return NextResponse.json({ notes });
}
