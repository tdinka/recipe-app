"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecipeForm, emptyRecipeForm, type RecipeFormValues } from "@/components/RecipeForm";
import type { ExtractedRecipe } from "@/lib/recipe-extractor";
import { ingredientsToText, parseIngredientLines } from "@/lib/ingredient-parser";
import { IDEA_DRAFT_KEY } from "@/lib/constants";
import type { RecipeIdea } from "@/lib/recipe-ideas";

type Mode = "choose" | "url" | "image" | "text" | "manual" | "idea" | "review";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function httpLinkOrNull(link: string | null): string | null {
  if (!link) return null;
  try {
    return ["http:", "https:"].includes(new URL(link).protocol) ? link : null;
  } catch {
    return null;
  }
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

  const [pastedText, setPastedText] = useState("");
  const [textImporting, setTextImporting] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  // The post a recipe came from, when it was sent here by the Add to Recipe Box shortcut.
  const [sharedSource, setSharedSource] = useState<string | null>(null);
  const sharedImportStarted = useRef(false);

  const [formValues, setFormValues] = useState<RecipeFormValues | null>(null);

  // An AI idea from "What can I make?" being written out in full.
  const [idea, setIdea] = useState<RecipeIdea | null>(null);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  // The web idea being imported, so a blocked import can fall back to a Claude-written version.
  const [webIdea, setWebIdea] = useState<RecipeIdea | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);

    function populateForm(recipe: ExtractedRecipe | {
    title: string; sourceUrl: string | null; imageUrl: string | null; description: string | null;
    servings: number | null; prepMinutes: number | null; cookMinutes: number | null; totalMinutes: number | null;
    category: string | null; cuisine: string | null; tags?: string[];
    ingredients: { raw: string; group?: string | null }[]; instructions: string[];
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
      ingredientsText: ingredientsToText(recipe.ingredients),
      instructionsText: recipe.instructions.join("\n"),
      tagsText: (recipe.tags ?? []).join(", "),
    });
    setMode("review");
  }

  async function handleImportUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    importUrl(url);
  }

  async function importUrl(url: string) {
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


  async function importText(text: string, sourceUrl: string | null) {
    setTextImporting(true);
    setTextError(null);
    try {
      const res = await fetch("/api/recipes/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTextError(json.error ?? "Couldn't read that text.");
        return;
      }
      populateForm({ ...json.recipe, sourceUrl });
    } catch {
      setTextError("Couldn't read that text. Try again.");
    } finally {
      setTextImporting(false);
    }
  }

  function handleImportText(e: React.FormEvent) {
    e.preventDefault();
    if (!pastedText.trim()) return;
    importText(pastedText, sharedSource);
  }

  async function writeIdea(idea: RecipeIdea) {
    setIdeaError(null);
    try {
      const res = await fetch("/api/recipes/ideas/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: idea.title, description: idea.description, uses: idea.uses, toBuy: idea.toBuy }),
      });
      const json = await res.json();
      if (!res.ok) {
        setIdeaError(json.error ?? "Couldn't write that recipe out.");
        return;
      }
      setAiGenerated(true);
      populateForm(json.recipe);
    } catch {
      setIdeaError("Couldn't write that recipe out. Check your connection and try again.");
    }
  }

  // Arriving from the Add to Recipe Box shortcut: read the caption right away.
  // Arriving from "What can I make?": import the web recipe, or write out the AI idea.
  useEffect(() => {
    if (sharedImportStarted.current) return;
    sharedImportStarted.current = true;
    const params = new URLSearchParams(window.location.search);

    const ideaUrl = httpLinkOrNull(params.get("importUrl"));
    if (ideaUrl) {
      window.history.replaceState(null, "", "/recipes/new");
      if (params.get("fromIdea")) {
        try {
          const draft = JSON.parse(sessionStorage.getItem(IDEA_DRAFT_KEY) ?? "null");
          if (draft?.title && draft.url === ideaUrl) setWebIdea(draft);
        } catch {
          // No fallback offered; the normal import error still shows.
        }
      }
      setUrl(ideaUrl);
      setMode("url");
      importUrl(ideaUrl);
      return;
    }
    if (params.get("fromIdea")) {
      window.history.replaceState(null, "", "/recipes/new");
      let draft: RecipeIdea | null = null;
      try {
        draft = JSON.parse(sessionStorage.getItem(IDEA_DRAFT_KEY) ?? "null");
      } catch {
        draft = null;
      }
      if (draft?.title) {
        setIdea(draft);
        setMode("idea");
        writeIdea(draft);
        return;
      }
    }

    const text = params.get("sharedText")?.trim();
    if (!text) return;
    const source = httpLinkOrNull(params.get("sharedUrl"));
    window.history.replaceState(null, "", "/recipes/new");
    setSharedSource(source);
    setPastedText(text);
    setMode("text");
    importText(text, source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      ingredients: parseIngredientLines(values.ingredientsText),
      instructions: values.instructionsText.split("\n").map((l) => l.trim()).filter(Boolean),
      tags: values.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      aiGenerated,
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
    setPastedText("");
    setTextError(null);
    setSharedSource(null);
    setIdea(null);
    setIdeaError(null);
    setWebIdea(null);
    setAiGenerated(false);
    setMode("choose");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-ink">Add a recipe</h1>

      {mode === "choose" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button onClick={() => setMode("url")} className="card p-5 text-left hover:border-brick/50">
            <p className="font-display text-lg">Paste a link</p>
            <p className="mt-1 text-sm text-ink-light">Best for most recipe sites and food blogs.</p>
          </button>
                    <button onClick={() => setMode("image")} className="card p-5 text-left hover:border-brick/50">
            <p className="font-display text-lg">Upload a screenshot</p>
            <p className="mt-1 text-sm text-ink-light">For sites that won't import, or a photo of a printed/handwritten recipe.</p>
          </button>
          <button onClick={() => setMode("text")} className="card p-5 text-left hover:border-brick/50">
            <p className="font-display text-lg">Paste the text</p>
            <p className="mt-1 text-sm text-ink-light">For blocked sites, or pages too long to screenshot — copy and paste the recipe text.</p>
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
          {urlError && webIdea && webIdea.url === url && (
            <div className="space-y-2 rounded-lg bg-mustard-50 p-3 text-sm text-ink">
              <p>
                This site doesn&apos;t let the app read its recipes. Claude can write its own version of
                &ldquo;{webIdea.title}&rdquo; instead. It&apos;s marked untested until you&apos;ve cooked it.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const fallback: RecipeIdea = { ...webIdea, kind: "ai", url: null, site: null };
                    setIdea(fallback);
                    setMode("idea");
                    writeIdea(fallback);
                  }}
                  className="btn-primary"
                >
                  ✨ Have Claude write a version
                </button>
                <a href={webIdea.url} target="_blank" rel="noopener noreferrer" className="underline">
                  View on site ↗
                </a>
              </div>
            </div>
          )}
          <p className="text-xs text-ink-light">
            Works best on sites that publish structured recipe data (most food blogs and recipe sites do).
            For Instagram and TikTok, use the shortcut in Settings or paste the caption.
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

      {mode === "text" && (
        <form onSubmit={handleImportText} className="card mt-6 space-y-3 p-6">
          <button type="button" onClick={startOver} className="text-xs text-ink-light hover:underline">← Choose a different method</button>
          <label className="label" htmlFor="pastedText">Paste the recipe text</label>
          <p className="text-xs text-ink-light">
            Select and copy the recipe from the page — title, ingredients, and instructions. Stray text like ads or comments is fine to include; it'll be ignored.
          </p>
          <textarea
            id="pastedText"
            className="input min-h-[240px] font-mono text-xs"
            placeholder="Paste the recipe text here…"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          {textError && <p className="text-sm text-brick">{textError}</p>}
          <button type="submit" disabled={!pastedText.trim() || textImporting} className="btn-primary">
            {textImporting ? "Reading text…" : "Extract recipe"}
          </button>
        </form>
      )}

      {mode === "manual" && (
        <div className="mt-6">
          <button type="button" onClick={startOver} className="mb-3 text-xs text-ink-light hover:underline">← Choose a different method</button>
          <RecipeForm initial={emptyRecipeForm} onSubmit={handleSave} submitLabel="Save recipe" />
        </div>
      )}

      {mode === "idea" && idea && (
        <div className="card mt-6 space-y-3 p-6">
          <p className="label">✨ New idea</p>
          <p className="font-display text-xl text-ink">{idea.title}</p>
          {ideaError ? (
            <>
              <p className="text-sm text-brick">{ideaError}</p>
              <div className="flex gap-2">
                <button onClick={() => writeIdea(idea)} className="btn-primary">Try again</button>
                <button onClick={() => router.back()} className="btn-secondary">Back to ideas</button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-3 text-sm text-ink-light">
              <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-linen-300 border-t-forest" />
              Writing out the full recipe… about 15 seconds.
            </p>
          )}
        </div>
      )}

      {mode === "review" && formValues && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-forest-50 px-4 py-2 text-sm text-forest-dark">
            <span>
              {aiGenerated
                ? "Written by Claude. Review it and save it to your box. It's marked “AI-generated” until you've cooked it."
                : "Imported! Review and edit anything before saving."}
            </span>
            <button className="font-semibold hover:underline" onClick={startOver}>Start over</button>
          </div>
          <RecipeForm initial={formValues} onSubmit={handleSave} submitLabel="Save recipe" />
        </div>
      )}
    </div>
  );
}
