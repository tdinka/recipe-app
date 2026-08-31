"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeForm, emptyRecipeForm, type RecipeFormValues } from "@/components/RecipeForm";
import type { ExtractedRecipe } from "@/lib/recipe-extractor";
import { parseIngredientLine } from "@/lib/ingredient-parser";

type Mode = "choose" | "url" | "image" | "manual" | "review";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export default function NewRecipePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");

  const [url, setUrl] = useState("");
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageImporting, setImageImporting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formValues, setFormValues] = useState<RecipeFormValues | null>(null);

  function populateForm(recipe: ExtractedRecipe | {
    title: string; sourceUrl: string | null; imageUrl: string | null; description: string | null;
    servings: number | null; prepMinutes: number | null; cookMinutes: number | null; totalMinutes: number | null;
    category: string | null; cuisine: string | null;
    ingredients: { raw: string }[]; instructions: string[];
  }) {
    setFormValues({
      title: recipe.title,
      sourceUrl: recipe.sourceUrl,
      imageUrl: recipe.imageUrl,
      imageAttributionName: null,
      imageAttributionUrl: null,
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.totalMinutes,
      category: recipe.category,
      cuisine: recipe.cuisine,
      ingredientsText: recipe.ingredients.map((i) => i.raw).join("\n"),
      instructionsText: recipe.instructions.join("\n"),
      tagsText: "",
    });
    setMode("review");
  }

  async function handleImportUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setUrlImporting(true);
    setUrlError(null);
    try {
      const res = await fetch("/api/recipes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUrlError(json.error ?? "Couldn't import that recipe.");
        return;
      }
      populateForm(json.recipe as ExtractedRecipe);
    } catch {
      setUrlError("Couldn't import that recipe. Check the link and try again.");
    } finally {
      setUrlImporting(false);
    }
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);

    if (file.size > 8 * 1024 * 1024) {
      setImageError("That image is a bit large — try a screenshot under ~6MB.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setImagePreview(dataUrl);
  }

  async function handleImportImage() {
    if (!imagePreview) return;
    setImageImporting(true);
    setImageError(null);
    try {
      const res = await fetch("/api/recipes/extract-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imagePreview }),
      });
      const json = await res.json();
      if (!res.ok) {
        setImageError(json.error ?? "Couldn't read that image.");
        return;
      }
      populateForm(json.recipe);
    } catch {
      setImageError("Couldn't read that image. Try again.");
    } finally {
      setImageImporting(false);
    }
  }

  async function handleSave(values: RecipeFormValues) {
    const payload = {
      title: values.title,
      sourceUrl: values.sourceUrl || null,
      imageUrl: values.imageUrl || null,
      imageAttributionName: values.imageAttributionName || null,
      imageAttributionUrl: values.imageAttributionUrl || null,
      description: values.description || null,
      servings: values.servings,
      prepMinutes: values.prepMinutes,
      cookMinutes: values.cookMinutes,
      totalMinutes: values.totalMinutes,
      category: values.category,
      cuisine: values.cuisine,
      ingredients: values.ingredientsText.split("\n").map((l) => l.trim()).filter(Boolean).map((raw) => parseIngredientLine(raw)),
      instructions: values.instructionsText.split("\n").map((l) => l.trim()).filter(Boolean),
      tags: values.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Couldn't save this recipe.");
    router.push(`/recipes/${json.id}`);
  }

  function startOver() {
    setFormValues(null);
    setUrl("");
    setUrlError(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMode("choose");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-ink">Add a recipe</h1>

      {mode === "choose" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button onClick={() => setMode("url")} className="card p-5 text-left hover:border-brick/50">
            <p className="font-display text-lg">Paste a link</p>
            <p className="mt-1 text-sm text-ink-light">Best for most recipe sites and food blogs.</p>
          </button>
          <button onClick={() => setMode("image")} className="card p-5 text-left hover:border-brick/50">
            <p className="font-display text-lg">Upload a screenshot</p>
            <p className="mt-1 text-sm text-ink-light">For sites that won't import, or a photo of a printed/handwritten recipe.</p>
          </button>
          <button onClick={() => setMode("manual")} className="card p-5 text-left hover:border-brick/50">
            <p className="font-display text-lg">Enter by hand</p>
            <p className="mt-1 text-sm text-ink-light">Type it in yourself, start to finish.</p>
          </button>
        </div>
      )}

      {mode === "url" && (
        <form onSubmit={handleImportUrl} className="card mt-6 space-y-3 p-6">
          <button type="button" onClick={startOver} className="text-xs text-ink-light hover:underline">← Choose a different method</button>
          <label className="label" htmlFor="url">Paste a recipe link</label>
          <div className="flex gap-2">
            <input
              id="url" className="input" placeholder="https://example.com/amazing-lasagna"
              value={url} onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" disabled={urlImporting} className="btn-primary shrink-0">
              {urlImporting ? "Importing…" : "Import"}
            </button>
          </div>
          {urlError && (
            <div className="text-sm text-brick">
              {urlError}{" "}
              <button type="button" onClick={() => setMode("image")} className="font-semibold underline">
                Try a screenshot instead?
              </button>
            </div>
          )}
          <p className="text-xs text-ink-light">
            Works best on sites that publish structured recipe data (most food blogs and recipe sites do).
          </p>
        </form>
      )}

      {mode === "image" && (
        <div className="card mt-6 space-y-3 p-6">
          <button type="button" onClick={startOver} className="text-xs text-ink-light hover:underline">← Choose a different method</button>
          <label className="label">Upload a screenshot or photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageSelected}
            className="block w-full text-sm text-ink-light file:mr-3 file:rounded-card file:border-0 file:bg-forest file:px-4 file:py-2 file:text-sm file:font-semibold file:text-linen-50 hover:file:bg-forest-dark"
          />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="Selected screenshot preview" className="mt-2 max-h-80 rounded-card border border-linen-300 object-contain" />
          )}
          {imageError && <p className="text-sm text-brick">{imageError}</p>}
          <button
            type="button"
            onClick={handleImportImage}
            disabled={!imagePreview || imageImporting}
            className="btn-primary"
          >
            {imageImporting ? "Reading image…" : "Extract recipe"}
          </button>
          <p className="text-xs text-ink-light">
            Works on screenshots of recipe pages, photos of cookbook pages, or clear handwritten recipe cards.
            Requires an Anthropic API key configured on the server (see README).
          </p>
        </div>
      )}

      {mode === "manual" && (
        <div className="mt-6">
          <button type="button" onClick={startOver} className="mb-3 text-xs text-ink-light hover:underline">← Choose a different method</button>
          <RecipeForm initial={emptyRecipeForm} onSubmit={handleSave} submitLabel="Save recipe" />
        </div>
      )}

      {mode === "review" && formValues && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between rounded-md bg-forest-50 px-4 py-2 text-sm text-forest-dark">
            <span>Imported! Review and edit anything before saving.</span>
            <button className="font-semibold hover:underline" onClick={startOver}>Start over</button>
          </div>
          <RecipeForm initial={formValues} onSubmit={handleSave} submitLabel="Save recipe" />
        </div>
      )}
    </div>
  );
}
