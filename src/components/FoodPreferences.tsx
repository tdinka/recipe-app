"use client";

import { useEffect, useState } from "react";

type PrefKey = "prefsWhoEating" | "prefsDislikes" | "prefsDietGoals" | "prefsCookTime" | "prefsCuisines" | "prefsEquipment";
type Prefs = Record<PrefKey, string>;

const FIELDS: { key: PrefKey; label: string; placeholder: string }[] = [
  { key: "prefsWhoEating", label: "Who's eating", placeholder: "e.g. 2 adults and 2 teens" },
  { key: "prefsDislikes", label: "Dislikes and spice level", placeholder: "e.g. mild spice, no mushrooms" },
  { key: "prefsDietGoals", label: "Diet goals", placeholder: "e.g. healthy, red meat at most 2 days a week" },
  { key: "prefsCookTime", label: "Cooking time", placeholder: "e.g. up to an hour" },
  { key: "prefsCuisines", label: "Cuisines you love", placeholder: "e.g. Mexican, Thai, Ethiopian" },
  { key: "prefsEquipment", label: "Kitchen equipment", placeholder: "e.g. stovetop and oven" },
];

const EMPTY: Prefs = {
  prefsWhoEating: "",
  prefsDislikes: "",
  prefsDietGoals: "",
  prefsCookTime: "",
  prefsCuisines: "",
  prefsEquipment: "",
};

// Plain-words answers that Claude reads when suggesting recipes.
export function FoodPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saved, setSaved] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/household/preferences").then(async (res) => {
      if (!res.ok) {
        setError("Couldn't load food preferences.");
        return;
      }
      const json = await res.json();
      const loaded = { ...EMPTY };
      for (const { key } of FIELDS) loaded[key] = json.prefs?.[key] ?? "";
      setPrefs(loaded);
      setSaved(loaded);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/household/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save.");
      setSaved(prefs);
      setMessage("Saved.");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const changed = prefs && saved && FIELDS.some(({ key }) => prefs[key] !== saved[key]);

  return (
    <form onSubmit={handleSave} className="card p-6">
      <p className="label">Recipe ideas</p>
      <p className="font-display text-xl text-ink">Food preferences</p>
      <p className="mt-1 text-sm text-ink-light">
        Write these in your own words. Claude follows them when it suggests recipes for your household. Leave a
        box empty if it doesn&apos;t matter.
      </p>
      {error && <p className="mt-3 text-sm text-brick">{error}</p>}
      {prefs && (
        <>
          <div className="mt-4 space-y-4">
            {FIELDS.map(({ key, label, placeholder }) => (
              <label key={key} className="block">
                <span className="label">{label}</span>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={prefs[key]}
                  placeholder={placeholder}
                  maxLength={500}
                  onChange={(e) => setPrefs({ ...prefs, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={saving || !changed} className="btn-primary">
              {saving ? "Saving…" : "Save preferences"}
            </button>
            {message && <span className="text-sm text-forest-dark">{message}</span>}
          </div>
        </>
      )}
    </form>
  );
}
