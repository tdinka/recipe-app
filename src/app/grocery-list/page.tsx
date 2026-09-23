import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

// The grocery list now lives at the shared family link, so everyone
// (logged in or not) sees the same list.
export default async function GroceryListPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  const householdId = session.user.householdId;

  const household = await db.household.findUnique({ where: { id: householdId }, select: { listToken: true } });
  let token = household?.listToken;
  if (!token) {
    token = randomBytes(18).toString("base64url");
    await db.household.update({ where: { id: householdId }, data: { listToken: token } });
  }
  redirect(`/list/${token}`);
}
