import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { extractRecipeFromUrl, RecipeExtractionError } from "@/lib/recipe-extractor";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "A URL is required." }, { status: 400 });

  try {
    const recipe = await extractRecipeFromUrl(url);
    return NextResponse.json({ recipe });
  } catch (err) {
    if (err instanceof RecipeExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error while importing that recipe." }, { status: 500 });
  }
}
