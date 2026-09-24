import webpush from "web-push";
import { db } from "@/lib/db";

let configured = false;

// Load the push keys only when needed, so builds don't fail if they're missing.
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || ""
  );
  configured = true;
}

export type PushMessage = { title: string; body: string; url?: string };

// Sends a notification to every signed-up device. Returns how many succeeded.
export async function sendPushToAll(message: PushMessage): Promise<number> {
  configure();
  const subs = await db.pushSubscription.findMany();
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(message)
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // This device unsubscribed or the subscription expired, so clean it up.
        await db.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        console.error("Push failed", statusCode, err);
      }
    }
  }
  return sent;
}
