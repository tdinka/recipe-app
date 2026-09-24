import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";

export const dynamic = "force-dynamic";

// Wait for this many quiet minutes after the last addition before alerting...
const QUIET_MINUTES = 20;
// ...but never hold an item longer than this.
const MAX_WAIT_MINUTES = 60;
// How many item names to list before saying "and N more".
const MAX_NAMES = 6;

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await db.groceryItem.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: "asc" },
    include: { household: { select: { listToken: true } } },
  });

  if (pending.length === 0) {
    return NextResponse.json({ status: "nothing new" });
  }

  const now = Date.now();
  const quietFor = (now - pending[pending.length - 1].createdAt.getTime()) / 60000;
  const waitingFor = (now - pending[0].createdAt.getTime()) / 60000;

  if (quietFor < QUIET_MINUTES && waitingFor < MAX_WAIT_MINUTES) {
    return NextResponse.json({ status: "waiting", pending: pending.length });
  }

  const count = pending.length;
  const names = pending.map((item) => item.name);
  const shown = names.slice(0, MAX_NAMES).join(", ");
  const extra = count - MAX_NAMES;
  const token = pending[0].household.listToken;

  const sent = await sendPushToAll({
    title: `🛒 ${count} new item${count === 1 ? "" : "s"} on the grocery list`,
    body: extra > 0 ? `${shown}, and ${extra} more` : shown,
    url: token ? `/list/${token}` : "/",
  });

  // Mark these items as announced so they're never included in another alert.
  await db.groceryItem.updateMany({
    where: { id: { in: pending.map((item) => item.id) } },
    data: { notifiedAt: new Date() },
  });

  return NextResponse.json({ status: "sent", items: count, devices: sent });
}

export const GET = run;
export const POST = run;
