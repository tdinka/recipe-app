import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  const res = await fetch(target.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RecipeBox/1.0)" },
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
