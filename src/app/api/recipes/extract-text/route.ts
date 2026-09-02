import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { extractRecipeFromText, VisionExtractionError } from "@/lib/recipe-vision-extractor";

const schema = z.object({
  text: z.string().min(1),
});

// Generous cap on pasted text length — plenty for even a very long recipe page.
const MAX_TEXT_LENGTH = 50_000;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "No text was provided." }, { status: 400 });
  }

  if (parsed.data.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "That's a lot of text — try trimming it down to just the recipe itself." }, { status: 413 });
  }

  try {
    const recipe = await extractRecipeFromText(parsed.data.text);
    return NextResponse.json({ recipe });
  } catch (err) {
    if (err instanceof VisionExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error while reading that text." }, { status: 500 });
  }
}
