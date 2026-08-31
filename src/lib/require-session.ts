import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Returns the session, or null if the request is unauthenticated.
// API routes should return a 401 when this comes back null.
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.householdId) return null;
  return session;
}
