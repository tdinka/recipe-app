"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeCard, type RecipeCardData } from "@/components/RecipeCard";
import { CATEGORIES } from "@/lib/constants";
export const dynamic = "force-dynamic";

export default function RecipesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const q = searchParams.get("q") ?? "";

  const [recipes, setRecipes] = useState<RecipeCardData[] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState(q);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (tag) params.set("tag", tag);
    if (q) params.set("q", q);
    const res = await fetch(`/api/recipes?${params.toString()}`);
    const json = await res.json();
    setRecipes(json.recipes ?? []);
  }, [category, tag, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then((json) => setTags(json.tags ?? []));
  }, []);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/recipes?${params.toString()}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Your Recipe Box</h1>
          <p className="mt-1 text-sm text-ink-light">
            {recipes ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        <Link href="/recipes/new" className="btn-primary">+ Add a recipe</Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form
          onSubmit={(e) => { e.preventDefault(); updateParam("q", searchInput); }}
          className="flex-1 min-w-[200px]"
        >
          <input
            className="input"
            placeholder="Search your recipes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <select className="input w-auto" value={category} onChange={(e) => updateParam("category", e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-auto" value={tag} onChange={(e) => updateParam("tag", e.target.value)}>
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {(category || tag || q) && (
          <button className="btn-ghost" onClick={() => router.push("/recipes")}>Clear filters</button>
        )}
      </div>

      {recipes && recipes.length === 0 && (
        <div className="card mt-10 p-10 text-center">
          <p className="font-display text-xl text-ink">Nothing here yet.</p>
          <p className="mt-2 text-sm text-ink-light">
            Paste a link from any recipe site to start filling your box.
          </p>
          <Link href="/recipes/new" className="btn-primary mt-4 inline-flex">+ Add your first recipe</Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes?.map((r) => <RecipeCard key={r.id} recipe={r} />)}
      </div>
    </div>
  );
}
