import { Suspense } from "react";
import RecipesPageClient from "./RecipesPageClient";

export default function RecipesPage() {
  return (
    <Suspense fallback={<p className="text-ink-light">Loading…</p>}>
      <RecipesPageClient />
    </Suspense>
  );
}