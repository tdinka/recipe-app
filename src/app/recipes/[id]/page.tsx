"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { MEAL_TYPES } from "@/lib/constants";
import { scaleQuantityText, formatScaledNumber } from "@/lib/scale-quantity";
import { startsGroup, type ParsedIngredient } from "@/lib/ingredient-parser";
import { PhotoPicker, type SelectedPhoto } from "@/components/PhotoPicker";
import { proxiedImageUrl } from "@/lib/image-proxy";

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

// Screen Wake Lock: keeps the phone from dimming while cooking.
type WakeLockLike = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
};

function toggleIn(set: Set<number>, i: number): Set<number> {
  const next = new Set(set);
  if (next.has(i)) {
    next.delete(i);
  } else {
    next.add(i);
  }
  return next;
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
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

  // Cook mode + tap-to-check
  const [cookMode, setCookMode] = useState(false);
  const [awake, setAwake] = useState<"on" | "unsupported" | null>(null);
  const wakeLockRef = useRef<WakeLockLike | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());

  // Ingredients sent to the grocery list from this page, by row number.
  const [listAdds, setListAdds] = useState<Map<number, "adding" | "added" | "error">>(new Map());
  const [listMessage, setListMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!cookMode) return;
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock) {
      setAwake("unsupported");
      return;
    }
    let cancelled = false;

    async function acquire() {
      try {
        const lock = await wakeLock!.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
        setAwake("on");
      } catch {
        setAwake("unsupported");
      }
    }

    // Phones drop the lock when you switch apps, so grab it again on return.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setAwake(null);
    };
  }, [cookMode]);

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

  async function handleAddToList(i: number, ing: ParsedIngredient) {
    setListAdds((m) => new Map(m).set(i, "adding"));
    try {
      const res = await fetch("/api/grocery-list/add-ingredient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Include the unit so containers survive: "cans" + "black beans" → "Can of black beans".
        body: JSON.stringify({ ingredient: [ing.unit, ing.item].filter(Boolean).join(" ") || ing.raw }),
      });
      if (!res.ok) throw new Error("add failed");
      const { item, merged } = await res.json();
      setListAdds((m) => new Map(m).set(i, "added"));
      setListMessage(merged ? `"${item.name}" is already on the grocery list.` : `Added "${item.name}" to the grocery list.`);
    } catch {
      setListAdds((m) => new Map(m).set(i, "error"));
      setListMessage("Couldn't add that. Try again.");
    }
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

  const listText = cookMode ? "text-lg" : "text-base sm:text-sm";
  const anyChecked = checkedIngredients.size > 0 || doneSteps.size > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl text-ink sm:text-3xl">{recipe.title}</h1>
          {recipe.description && <p className="mt-2 text-ink-light">{recipe.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-ghost">Edit</Link>
          <button onClick={handleDelete} className="btn-ghost text-brick">Delete</button>
        </div>
      </div>

      {recipe.imageUrl ? (
        <div className="mt-4">
          <div className="relative h-56 w-full overflow-hidden rounded-card bg-linen-200 sm:h-72">
            <Image src={proxiedImageUrl(recipe.imageUrl)} alt={recipe.title} fill className="object-cover" unoptimized />
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

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        {recipe.category && <span className="category-pill">{recipe.category}</span>}
        {recipe.cuisine && <span className="text-sm text-ink-light">{recipe.cuisine}</span>}
        {recipe.servings && <span className="measure text-sm">Serves {formatScaledNumber(recipe.servings * scale)}</span>}
        {displayTotal ? <span className="measure text-sm">{displayTotal} min total</span> : null}
      </div>
      {recipe.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {recipe.tags.map((t) => <span key={t} className="tag-pill">{t}</span>)}
        </div>
      )}

      {recipe.sourceUrl && (
        <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-forest hover:underline">
          View original source ↗
        </a>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setCookMode((c) => !c)}
          className={`${cookMode ? "btn-ghost" : "btn-secondary"} w-full sm:w-auto`}
        >
          {cookMode ? "Done cooking" : "🍳 Start cooking"}
        </button>
        {cookMode && (
          <p className="text-xs text-ink-light">
            {awake === "on" && "Your screen will stay on. "}
            {awake === "unsupported" && "This browser can't keep the screen on, so give it a tap now and then. "}
            Tap ingredients and steps to check them off.
          </p>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl text-ink">Ingredients</h2>
            <div className="flex gap-1">
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setScale(opt)}
                  className={`min-w-[40px] rounded-md px-2 py-2 text-sm font-semibold transition-colors sm:min-w-0 sm:py-1 sm:text-xs ${
                    scale === opt ? "bg-forest text-linen-50" : "bg-linen-100 text-ink-light hover:bg-linen-200"
                  }`}
                >
                  {opt === 0.5 ? "½×" : `${opt}×`}
                </button>
              ))}
            </div>
          </div>
          <ul className={`mt-3 ${listText}`}>
            {recipe.ingredients.map((ing, i) => {
              const checked = checkedIngredients.has(i);
              const heading = startsGroup(recipe.ingredients, i);
              return (
                <Fragment key={i}>
                {heading && <li className="pb-1 pt-4 font-display text-base text-ink first:pt-0">{heading}</li>}
                <li className="flex items-start gap-2 border-b border-linen-300">
                  <button
                    type="button"
                    onClick={() => setCheckedIngredients((s) => toggleIn(s, i))}
                    aria-pressed={checked}
                    className={`flex min-w-0 flex-1 items-start gap-3 py-2 text-left transition-opacity ${checked ? "opacity-50" : ""}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        checked ? "border-forest bg-forest text-linen-50" : "border-linen-400 bg-white"
                      }`}
                    >
                      {checked && <CheckIcon />}
                    </span>
                    <span className={checked ? "line-through" : ""}>
                      {ing.quantity && <span className="measure">{scale === 1 ? ing.quantity : scaleQuantityText(ing.quantity, scale)} </span>}
                      {ing.unit && <span className="measure">{ing.unit} </span>}
                      {ing.item}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddToList(i, ing)}
                    disabled={listAdds.get(i) === "adding" || listAdds.get(i) === "added"}
                    aria-label={`Add ${ing.item} to the grocery list`}
                    className={`mt-1 shrink-0 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                      listAdds.get(i) === "added"
                        ? "bg-linen-100 text-forest"
                        : "bg-linen-100 text-ink-light hover:bg-linen-200"
                    }`}
                  >
                    {listAdds.get(i) === "added" ? "✓ List" : listAdds.get(i) === "adding" ? "…" : "+ List"}
                  </button>
                </li>
                </Fragment>
              );
            })}
            {recipe.ingredients.length === 0 && <li className="text-ink-light">No ingredients listed.</li>}
          </ul>
          {listMessage && (
            <p className="mt-2 text-xs text-ink-light" role="status">
              {listMessage}{" "}
              <Link href="/grocery-list" className="text-forest underline">See list</Link>
            </p>
          )}
          {scale !== 1 && (
            <p className="mt-2 text-xs text-ink-light">
              Scaled from the original recipe — items without a clear number (like "to taste") are left as-is.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <h2 className="font-display text-xl text-ink">Instructions</h2>
          <ol className={`mt-3 space-y-4 ${listText}`}>
            {recipe.instructions.map((step, i) => {
              const done = doneSteps.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setDoneSteps((s) => toggleIn(s, i))}
                    aria-pressed={done}
                    className={`flex w-full gap-3 text-left transition-opacity ${done ? "opacity-40" : ""}`}
                  >
                    <span className="w-6 shrink-0 font-display text-brick">{done ? "✓" : `${i + 1}.`}</span>
                    <span>{step}</span>
                  </button>
                </li>
              );
            })}
            {recipe.instructions.length === 0 && <li className="text-ink-light">No instructions listed.</li>}
          </ol>
          {anyChecked && (
            <button
              type="button"
              onClick={() => { setCheckedIngredients(new Set()); setDoneSteps(new Set()); }}
              className="mt-4 text-sm text-forest underline"
            >
              Clear checkmarks
            </button>
          )}
        </div>
      </div>

      <div className="card mt-10 p-5">
        <h2 className="font-display text-lg text-ink">Add to meal plan</h2>
        <form onSubmit={handleAddToPlan} className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
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
          <button type="submit" className="btn-secondary col-span-2 sm:col-auto">
            Add{scale !== 1 ? ` (${scale === 0.5 ? "½×" : `${scale}×`})` : ""}
          </button>
          {planStatus && <span className="col-span-2 text-sm text-ink-light sm:col-auto">{planStatus}</span>}
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
