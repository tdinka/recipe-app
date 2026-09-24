import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";

// Sends a test notification. Protected by the login wall.
export async function POST() {
  const sent = await sendPushToAll({
    title: "Grocery alerts are on 🎉",
    body: "This is a test. Real alerts will list the new items.",
    url: "/",
  });
  if (sent === 0) {
    return NextResponse.json({ error: "No devices received it" }, { status: 500 });
  }
  return NextResponse.json({ sent });
}
