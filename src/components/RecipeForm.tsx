"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";
import { parseIngredientLines } from "@/lib/ingredient-parser";
import { PhotoPicker, type SelectedPhoto } from "@/components/PhotoPicker";

export interface RecipeFormValues {
  title: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  imageAttributionName: string | null;
  imageAttributionUrl: string | null;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  category: string | null;
  cuisine: string | null;
  ingredientsText: string; // one per line
  instructionsText: string; // one per line
  tagsText: string; // comma separated
}

export const emptyRecipeForm: RecipeFormValues = {
  title: "",
  sourceUrl: null,
  imageUrl: null,
  imageAttributionName: null,
  imageAttributionUrl: null,
  description: null,
  servings: null,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  category: null,
  cuisine: null,
  ingredientsText: "",
  instructionsText: "",
  tagsText: "",
};

export function RecipeForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: RecipeFormValues;
  onSubmit: (values: RecipeFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState<RecipeFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  function handlePhotoSelected(photo: SelectedPhoto) {
    set("imageUrl", photo.url);
    set("imageAttributionName", photo.attributionName);
    set("imageAttributionUrl", photo.attributionUrl);
    setShowPhotoPicker(false);
  }

  function set<K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving this recipe.");
    } finally {
      setSaving(false);
    }
  }

  const ingredientPreview = parseIngredientLines(values.ingredientsText);
  const groupCount = new Set(ingredientPreview.map((p) => p.group).filter(Boolean)).size;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input className="input" value={values.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div>
          <label className="label">Image URL</label>
          <input className="input" value={values.imageUrl ?? ""} onChange={(e) => { set("imageUrl", e.target.value || null); set("imageAttributionName", null); set("imageAttributionUrl", null); }} />
          <button
            type="button"
            onClick={() => setShowPhotoPicker((v) => !v)}
            className="mt-1 text-xs font-medium text-forest hover:underline"
          >
            {values.imageUrl ? "Choose a different photo" : "Find a photo"}
          </button>
          {values.imageAttributionName && values.imageAttributionUrl && (
            <p className="mt-1 text-[10px] text-ink-light">
              Photo by{" "}
              <a href={values.imageAttributionUrl} target="_blank" rel="noreferrer" className="underline">
                {values.imageAttributionName}
              </a>{" "}
              on Unsplash
            </p>
          )}
        </div>
      </div>

      {showPhotoPicker && (
        <PhotoPicker
          initialQuery={values.title || "recipe"}
          onSelect={handlePhotoSelected}
          onClose={() => setShowPhotoPicker(false)}
        />
      )}

      <div>
        <label className="label">Description</label>
        <textarea
          className="input"
          rows={2}
          value={values.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div>
          <label className="label">Servings</label>
          <input
            type="number" min={1} className="input"
            value={values.servings ?? ""}
            onChange={(e) => set("servings", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div>
          <label className="label">Prep (min)</label>
          <input
            type="number" min={0} className="input"
            value={values.prepMinutes ?? ""}
            onChange={(e) => set("prepMinutes", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div>
          <label className="label">Cook (min)</label>
          <input
            type="number" min={0} className="input"
            value={values.cookMinutes ?? ""}
            onChange={(e) => set("cookMinutes", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div>
          <label className="label">Total (min)</label>
          <input
            type="number" min={0} className="input"
            placeholder="If no split"
            value={values.totalMinutes ?? ""}
            onChange={(e) => set("totalMinutes", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={values.category ?? ""} onChange={(e) => set("category", e.target.value || null)}>
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Cuisine</label>
          <input className="input" value={values.cuisine ?? ""} onChange={(e) => set("cuisine", e.target.value || null)} />
        </div>
      </div>

      <div>
        <label className="label">Tags (comma separated)</label>
        <input
          className="input"
          placeholder="weeknight, kid-friendly, freezer-meal"
          value={values.tagsText}
          onChange={(e) => set("tagsText", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="label">Ingredients — one per line</label>
          <textarea
            className="input font-mono text-sm"
            rows={12}
            placeholder={"2 cups flour\n1 tsp salt\n3 large eggs\n\nFor the frosting:\n1 cup butter\n2 cups powdered sugar"}
            value={values.ingredientsText}
            onChange={(e) => set("ingredientsText", e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-light">
            To split ingredients into parts, put a heading on its own line ending in a colon, like &ldquo;Meatballs:&rdquo;.
          </p>
          {ingredientPreview.length > 0 && (
            <div className="mt-2 rounded-md bg-linen-100 p-3 text-xs text-ink-light">
              <p className="mb-1 font-semibold uppercase tracking-wide">Parsed preview</p>
              <ul className="space-y-0.5">
                {ingredientPreview.slice(0, 4).map((p, i) => (
                  <li key={i}>
                    {p.quantity && <span className="measure">{p.quantity} </span>}
                    {p.unit && <span className="measure">{p.unit} </span>}
                    {p.item}
                  </li>
                ))}
                {ingredientPreview.length > 4 && <li>… {ingredientPreview.length - 4} more</li>}
                {groupCount > 0 && <li>In {groupCount} group{groupCount === 1 ? "" : "s"}</li>}
              </ul>
            </div>
          )}
        </div>
        <div>
          <label className="label">Instructions — one step per line</label>
          <textarea
            className="input text-sm"
            rows={12}
            placeholder={"Preheat oven to 350°F.\nWhisk dry ingredients together.\nBake for 25 minutes."}
            value={values.instructionsText}
            onChange={(e) => set("instructionsText", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-brick">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
