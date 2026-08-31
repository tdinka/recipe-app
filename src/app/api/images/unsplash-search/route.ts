import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { searchUnsplashPhotos, UnsplashError } from "@/lib/unsplash";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "A search term is required." }, { status: 400 });

  try {
    const results = await searchUnsplashPhotos(query, 5);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof UnsplashError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error(err);
    return NextResponse.json({ error: "Unexpected error searching for photos." }, { status: 500 });
  }
}
