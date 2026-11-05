"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ServingSuggestion } from "@/lib/serving-suggestions";

// "Serve it with" ideas for a recipe. Written by Claude the first time the recipe
// is opened, then saved; can be refreshed or edited by hand.
export function ServingSuggestions({ recipeId, initial }: { recipeId: string; initial: ServingSuggestion[] | null }) {
  const [suggestions, setSuggestions] = useState<ServingSuggestion[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const requested = useRef(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/serving-suggestions`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      setSuggestions(json.suggestions);
    } catch (err) {
      setError(err instanceof Error && err.message !== "failed" ? err.message : "Couldn't come up with suggestions. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // First visit to a recipe with no suggestions yet: write some automatically.
  useEffect(() => {
    if (initial === null && !requested.current) {
      requested.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveEdits() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/serving-suggestions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: draft.split("\n") }),
      });
      if (!res.ok) throw new Error("save failed");
      setSuggestions((await res.json()).suggestions);
      setEditing(false);
    } catch {
      setError("Couldn't save your changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card mt-10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink">🍽️ Serve it with</h2>
        {!editing && !loading && (
          <div className="flex gap-3 text-sm font-semibold">
            <button type="button" onClick={generate} className="text-forest underline">
              New ideas
            </button>
            {suggestions && (
              <button
                type="button"
                onClick={() => { setDraft(suggestions.map((s) => s.text).join("\n")); setEditing(true); }}
                className="text-forest underline"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-2">
          <p className="text-xs text-ink-light">One suggestion per line.</p>
          <textarea
            className="input mt-1 min-h-[110px] w-full"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={saveEdits} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      ) : loading ? (
        <p className="mt-2 text-sm text-ink-light">Coming up with ideas…</p>
      ) : suggestions && suggestions.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {suggestions.map((s, i) => (
            <li key={i} className="flex gap-2 text-ink">
              <span aria-hidden="true" className="text-brick">•</span>
              {s.recipeId ? (
                <Link href={`/recipes/${s.recipeId}`} className="text-forest underline">
                  {s.text}
                </Link>
              ) : (
                <span>{s.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !error && <p className="mt-2 text-sm text-ink-light">No suggestions yet.</p>
      )}
      {suggestions?.some((s) => s.recipeId) && !editing && !loading && (
        <p className="mt-2 text-xs text-ink-light">Underlined ideas are recipes already in your box.</p>
      )}
      {error && <p className="mt-2 text-sm text-brick">{error}</p>}
    </section>
  );
}
