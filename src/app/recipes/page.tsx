import { Suspense } from "react";
import RecipesPageClient from "./RecipesPageClient";

// This route depends on the signed-in user's session and is never the same
// twice, so skip static generation entirely and render it per-request.
export const dynamic = "force-dynamic";

export default function RecipesPage() {
  return (
    <Suspense fallback={<p className="text-ink-light">Loading…</p>}>
      <RecipesPageClient />
    </Suspense>
  );
}