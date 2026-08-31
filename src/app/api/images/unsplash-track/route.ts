import { NextResponse } from "next/server";
import { requireSession } from "@/lib/require-session";
import { triggerUnsplashDownload } from "@/lib/unsplash";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const downloadLocation = typeof body?.downloadLocation === "string" ? body.downloadLocation : "";
  if (downloadLocation) await triggerUnsplashDownload(downloadLocation);

  return NextResponse.json({ ok: true });
}
