import { Suspense } from "react";
import GroceryListPageClient from "./GroceryListPageClient";

export default function GroceryListPage() {
  return (
    <Suspense fallback={<p className="text-ink-light">Loading…</p>}>
      <GroceryListPageClient />
    </Suspense>
  );
}