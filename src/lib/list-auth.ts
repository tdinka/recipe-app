import { db } from "@/lib/db";

// The family list link works without a login: the secret token in the URL
// is what identifies the household.
export async function householdFromToken(token: string) {
  if (!token || token.length < 10) return null;
  return db.household.findUnique({
    where: { listToken: token },
    select: { id: true, name: true },
  });
}

export const ITEM_SELECT = {
  id: true,
  name: true,
  quantity: true,
  section: true,
  store: true,
} as const;
