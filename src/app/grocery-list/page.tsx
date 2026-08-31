import { Suspense } from "react";
import GroceryListPageClient from "./GroceryListPageClient";

// Same reasoning as recipes/page.tsx — always per-user, never statically generated.
export const dynamic = "force-dynamic";

export default function GroceryListPage() {
  return (
    <Suspense fallback={<p className="text-ink-light">Loading…</p>}>
      <GroceryListPageClient />
    </Suspense>
  );
}