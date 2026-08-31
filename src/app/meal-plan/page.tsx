"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { addDays, startOfWeek, format } from "date-fns";
import { MEAL_TYPES } from "@/lib/constants";

interface PlanEntry {
  id: string;
  date: string;
  mealType: string;
  scale: number;
  recipe: { id: string; title: string; imageUrl: string | null };
}
interface RecipeOption { id: string; title: string; }

export default function MealPlanPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [pickerFor, setPickerFor] = useState<{ date: string; mealType: string } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const start = format(days[0], "yyyy-MM-dd");
  const end = format(days[6], "yyyy-MM-dd");

  const loadEntries = useCallback(async () => {
    const res = await fetch(`/api/meal-plan?start=${start}&end=${end}`);
    const json = await res.json();
    setEntries(json.entries ?? []);
  }, [start, end]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    fetch("/api/recipes").then((r) => r.json()).then((json) =>
      setRecipes((json.recipes ?? []).map((r: { id: string; title: string }) => ({ id: r.id, title: r.title })))
    );
  }, []);

  async function addEntry(date: string, mealType: string, recipeId: string) {
    await fetch("/api/meal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mealType, recipeId }),
    });
    setPickerFor(null);
    setPickerSearch("");
    loadEntries();
  }

  async function removeEntry(id: string) {
    await fetch(`/api/meal-plan/${id}`, { method: "DELETE" });
    loadEntries();
  }

  const filteredRecipes = recipes.filter((r) => r.title.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-ink">Meal Plan</h1>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev week</button>
          <span className="text-sm font-medium text-ink-light">
            {format(days[0], "MMM d")} – {format(days[6], "MMM d, yyyy")}
          </span>
          <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next week →</button>
          <Link href={`/grocery-list?start=${start}&end=${end}`} className="btn-secondary">Build grocery list →</Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-7">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          return (
            <div key={dateStr} className="card min-w-[150px] p-3">
              <p className="font-display text-sm text-brick">{format(day, "EEE")}</p>
              <p className="text-xs text-ink-light">{format(day, "MMM d")}</p>

              <div className="mt-3 space-y-3">
                {MEAL_TYPES.map((mealType) => {
                  const dayEntries = entries.filter((e) => e.date === dateStr && e.mealType === mealType);
                  const isPicking = pickerFor?.date === dateStr && pickerFor?.mealType === mealType;
                  return (
                    <div key={mealType}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-light">{mealType}</p>
                      <div className="mt-1 space-y-1">
                        {dayEntries.map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded-md bg-linen-100 px-2 py-1 text-xs">
                            <Link href={`/recipes/${e.recipe.id}`} className="truncate hover:underline">
                              {e.recipe.title}
                              {e.scale !== 1 && <span className="measure ml-1 text-[10px]">{e.scale === 0.5 ? "½×" : `${e.scale}×`}</span>}
                            </Link>
                            <button onClick={() => removeEntry(e.id)} className="ml-1 shrink-0 text-ink-light hover:text-brick">✕</button>
                          </div>
                        ))}
                        {isPicking ? (
                          <div className="rounded-md border border-linen-400 bg-white p-2">
                            <input
                              autoFocus
                              className="input !py-1 text-xs"
                              placeholder="Search recipes…"
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                            />
                            <div className="mt-1 max-h-32 overflow-y-auto">
                              {filteredRecipes.slice(0, 8).map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => addEntry(dateStr, mealType, r.id)}
                                  className="block w-full truncate rounded px-1 py-1 text-left text-xs hover:bg-linen-100"
                                >
                                  {r.title}
                                </button>
                              ))}
                              {filteredRecipes.length === 0 && <p className="px-1 py-1 text-xs text-ink-light">No matches.</p>}
                            </div>
                            <button className="mt-1 text-[10px] text-ink-light hover:underline" onClick={() => setPickerFor(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPickerFor({ date: dateStr, mealType })}
                            className="w-full rounded-md border border-dashed border-linen-400 py-1 text-[10px] text-ink-light hover:border-forest hover:text-forest"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
