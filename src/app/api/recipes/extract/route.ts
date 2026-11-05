import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { extractRecipeFromUrl, RecipeExtractionError } from "@/lib/recipe-extractor";

// These sites don't give their posts to a server, so importing by link can only produce an empty recipe.
const SOCIAL_SITE = /(^|\.)(instagram\.com|tiktok\.com)$/i;

function isSocialLink(url: string) {
  try {
    return SOCIAL_SITE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "A URL is required." }, { status: 400 });

  if (isSocialLink(url)) {
    return NextResponse.json(
      {
        error:
          "Instagram and TikTok links can't be imported directly. Open the post in Safari and use the Add to Recipe Box shortcut (set it up in Settings), or copy the caption and use Paste the text.",
      },
      { status: 422 }
    );
  }

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
