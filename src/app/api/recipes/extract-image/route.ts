import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/require-session";
import { extractRecipeFromImage, VisionExtractionError } from "@/lib/recipe-vision-extractor";

const schema = z.object({
  // A data URL, e.g. "data:image/png;base64,AAAA..."
  image: z.string().min(1),
});

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/;

// Roughly 8MB of base64 text (~6MB decoded) — generous for a screenshot, small enough to keep requests fast.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "No image was provided." }, { status: 400 });
  }

  const match = parsed.data.image.match(DATA_URL_PATTERN);
  if (!match) {
    return NextResponse.json({ error: "Unsupported image format. Please use a PNG, JPEG, or WEBP screenshot." }, { status: 400 });
  }
  const [, mediaType, base64Data] = match;

  if (base64Data.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "That image is too large. Try a smaller screenshot (under ~6MB)." }, { status: 413 });
  }

  try {
    const recipe = await extractRecipeFromImage(mediaType, base64Data);
    return NextResponse.json({ recipe });
  } catch (err) {
    if (err instanceof VisionExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error while reading that image." }, { status: 500 });
  }
}
