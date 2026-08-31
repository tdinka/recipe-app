"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { MEAL_TYPES } from "@/lib/constants";
import { scaleQuantityText, formatScaledNumber } from "@/lib/scale-quantity";
import type { ParsedIngredient } from "@/lib/ingredient-parser";
import { PhotoPicker, type SelectedPhoto } from "@/components/PhotoPicker";

interface RecipeDetail {
  id: string;
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
  ingredients: ParsedIngredient[];
  instructions: string[];
  tags: string[];
}

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planMealType, setPlanMealType] = useState<string>("Dinner");
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  const SCALE_OPTIONS = [0.5, 1, 2, 3];
  const [scale, setScale] = useState(1);

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  async function handlePhotoSelected(photo: SelectedPhoto) {
    if (!recipe) return;
    setSavingPhoto(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.title,
          sourceUrl: recipe.sourceUrl,
          imageUrl: photo.url,
          imageAttributionName: photo.attributionName,
          imageAttributionUrl: photo.attributionUrl,
          description: recipe.description,
          servings: recipe.servings,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          totalMinutes: recipe.totalMinutes,
          category: recipe.category,
          cuisine: recipe.cuisine,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          tags: recipe.tags,
        }),
      });
      if (res.ok) {
        setRecipe({ ...recipe, imageUrl: photo.url, imageAttributionName: photo.attributionName, imageAttributionUrl: photo.attributionUrl });
        setShowPhotoPicker(false);
      }
    } finally {
      setSavingPhoto(false);
    }
  }

  useEffect(() => {
    fetch(`/api/recipes/${params.id}`).then(async (res) => {
      if (!res.ok) { setNotFound(true); return; }
      const json = await res.json();
      setRecipe(json.recipe);
    });
  }, [params.id]);

  async function handleDelete() {
    if (!confirm("Delete this recipe? This can't be undone.")) return;
    await fetch(`/api/recipes/${params.id}`, { method: "DELETE" });
    router.push("/recipes");
  }

  async function handleAddToPlan(e: React.FormEvent) {
    e.preventDefault();
    setPlanStatus(null);
    const res = await fetch("/api/meal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: planDate, mealType: planMealType, recipeId: params.id, scale }),
    });
    setPlanStatus(res.ok ? "Added to your meal plan." : "Couldn't add that — try again.");
  }

  if (notFound) {
    return <p className="text-ink-light">Recipe not found.</p>;
  }
  if (!recipe) {
    return <p className="text-ink-light">Loading…</p>;
  }

  const totalTime = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  // Some sites only publish a single combined time (no prep/cook split) — show that instead.
  const displayTotal = totalTime > 0 ? totalTime : recipe.totalMinutes;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">{recipe.title}</h1>
          {recipe.description && <p className="mt-2 text-ink-light">{recipe.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-ghost">Edit</Link>
          <button onClick={handleDelete} className="btn-ghost text-brick">Delete</button>
        </div>
      </div>

      {recipe.imageUrl ? (
        <div className="mt-4">
          <div className="relative h-72 w-full overflow-hidden rounded-card bg-linen-200">
            <Image src={recipe.imageUrl} alt={recipe.title} fill className="object-cover" unoptimized />
          </div>
          {recipe.imageAttributionName && recipe.imageAttributionUrl && (
            <p className="mt-1 text-[10px] text-ink-light">
              Photo by{" "}
              <a href={recipe.imageAttributionUrl} target="_blank" rel="noreferrer" className="underline">
                {recipe.imageAttributionName}
              </a>{" "}
              on Unsplash
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {!showPhotoPicker && (
            <button onClick={() => setShowPhotoPicker(true)} className="btn-ghost">
              + Add a photo
            </button>
          )}
          {showPhotoPicker && (
            <div className="relative">
              <PhotoPicker
                initialQuery={recipe.title}
                onSelect={handlePhotoSelected}
                onClose={() => setShowPhotoPicker(false)}
              />
              {savingPhoto && <p className="mt-1 text-xs text-ink-light">Saving…</p>}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {recipe.category && <span className="category-pill">{recipe.category}</span>}
        {recipe.cuisine && <span className="text-sm text-ink-light">{recipe.cuisine}</span>}
        {recipe.servings && <span className="measure text-sm">Serves {formatScaledNumber(recipe.servings * scale)}</span>}
        {displayTotal ? <span className="measure text-sm">{displayTotal} min total</span> : null}
        {recipe.tags.map((t) => <span key={t} className="tag-pill">{t}</span>)}
      </div>

      {recipe.sourceUrl && (
        <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-forest hover:underline">
          View original source ↗
        </a>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Ingredients</h2>
            <div className="flex gap-1">
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setScale(opt)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    scale === opt ? "bg-forest text-linen-50" : "bg-linen-100 text-ink-light hover:bg-linen-200"
                  }`}
                >
                  {opt === 0.5 ? "½×" : `${opt}×`}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="border-b border-linen-300 pb-2">
                {ing.quantity && <span className="measure">{scale === 1 ? ing.quantity : scaleQuantityText(ing.quantity, scale)} </span>}
                {ing.unit && <span className="measure">{ing.unit} </span>}
                {ing.item}
              </li>
            ))}
            {recipe.ingredients.length === 0 && <li className="text-ink-light">No ingredients listed.</li>}
          </ul>
          {scale !== 1 && (
            <p className="mt-2 text-xs text-ink-light">
              Scaled from the original recipe — items without a clear number (like "to taste") are left as-is.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <h2 className="font-display text-xl text-ink">Instructions</h2>
          <ol className="mt-3 space-y-4 text-sm">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-brick">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
            {recipe.instructions.length === 0 && <li className="text-ink-light">No instructions listed.</li>}
          </ol>
        </div>
      </div>

      <div className="card mt-10 p-5">
        <h2 className="font-display text-lg text-ink">Add to meal plan</h2>
        <form onSubmit={handleAddToPlan} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Meal</label>
            <select className="input" value={planMealType} onChange={(e) => setPlanMealType(e.target.value)}>
              {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-secondary">
            Add{scale !== 1 ? ` (${scale === 0.5 ? "½×" : `${scale}×`})` : ""}
          </button>
          {planStatus && <span className="text-sm text-ink-light">{planStatus}</span>}
        </form>
        {scale !== 1 && (
          <p className="mt-2 text-xs text-ink-light">
            Uses the {scale === 0.5 ? "½×" : `${scale}×`} scale selected above — your grocery list will pull scaled quantities for this meal.
          </p>
        )}
      </div>
    </div>
  );
}
