"use client";

import { useState } from "react";

// The household's own notes on a recipe ("used half the sugar", "double the sauce").
// Styled like a sticky note so it stands out from the recipe itself.
export function RecipeNotes({ recipeId, initialNotes }: { recipeId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(notes);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft }),
      });
      if (!res.ok) throw new Error("save failed");
      const json = await res.json();
      setNotes(json.notes ?? "");
      setEditing(false);
    } catch {
      setError("Couldn't save your notes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing && !notes) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="mt-4 w-full rounded-card border-2 border-dashed border-mustard bg-mustard-50 px-4 py-3 text-left text-sm font-semibold text-mustard-dark hover:bg-mustard-50/70"
      >
        📝 + Add notes: changes you made, what worked, what to try next time
      </button>
    );
  }

  return (
    <section className="mt-4 rounded-card border-l-4 border-mustard bg-mustard-50 p-4 shadow-card" aria-label="My notes">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink">📝 My notes</h2>
        {!editing && (
          <button type="button" onClick={startEditing} className="text-sm font-semibold text-mustard-dark underline">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            className="input min-h-[120px] w-full bg-white"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={"e.g. Used half the sugar, still sweet enough.\nAdd an extra clove of garlic.\nKids loved it."}
            maxLength={5000}
            autoFocus
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save notes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="btn-ghost">
              Cancel
            </button>
            {error && <span className="text-sm text-brick">{error}</span>}
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-ink">{notes}</p>
      )}
    </section>
  );
}
