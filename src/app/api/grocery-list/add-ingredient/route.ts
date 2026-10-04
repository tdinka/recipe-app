import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { genericIngredientName } from "@/lib/grocery";
import { addGroceryItem } from "@/lib/grocery-add";

const schema = z.object({
  ingredient: z.string().trim().min(1).max(300),
});

// Adds one recipe ingredient to the family list as a plain item:
// "2 cups all-purpose flour, sifted" goes on as "Flour", with no amount.
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ingredient." }, { status: 400 });

  const { item, merged } = await addGroceryItem(session.user.householdId, {
    name: genericIngredientName(parsed.data.ingredient),
    skipAlert: true,
  });
  return NextResponse.json({ item, merged }, { status: merged ? 200 : 201 });
}
