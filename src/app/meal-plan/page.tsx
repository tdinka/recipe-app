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
  // Set in the browser only, so the server's clock/time zone can't disagree with the phone's.
  const [todayStr, setTodayStr] = useState<string | null>(null);

  useEffect(() => { setTodayStr(format(new Date(), "yyyy-MM-dd")); }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const start = format(days[0], "yyyy-MM-dd");
  const end = format(days[6], "yyyy-MM-dd");
  const isThisWeek = todayStr === null || days.some((d) => format(d, "yyyy-MM-dd") === todayStr);

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

  function openPicker(date: string, mealType: string) {
    setPickerSearch("");
    setPickerFor({ date, mealType });
  }

  const filteredRecipes = recipes.filter((r) => r.title.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">Meal Plan</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="flex flex-1 items-center justify-between gap-1 sm:flex-none sm:gap-2">
            <button
              className="btn-ghost !px-3"
              aria-label="Previous week"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ←<span className="hidden sm:inline">&nbsp;Prev week</span>
            </button>
            <span className="whitespace-nowrap text-sm font-medium text-ink-light">
              {format(days[0], "MMM d")} – {format(days[6], "MMM d")}
              <span className="hidden sm:inline">, {format(days[6], "yyyy")}</span>
            </span>
            <button
              className="btn-ghost !px-3"
              aria-label="Next week"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <span className="hidden sm:inline">Next week&nbsp;</span>→
            </button>
          </div>
          {!isThisWeek && (
            <button
              className="btn-ghost !px-3 text-xs"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              This week
            </button>
          )}
          <Link href={`/grocery-list?start=${start}&end=${end}`} className="btn-secondary w-full sm:w-auto">
            Build grocery list →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isToday = dateStr === todayStr;
          const emptyTypes = MEAL_TYPES.filter((mealType) => {
            const hasEntries = entries.some((e) => e.date === dateStr && e.mealType === mealType);
            const isPicking = pickerFor?.date === dateStr && pickerFor?.mealType === mealType;
            return !hasEntries && !isPicking;
          });
          return (
            <div key={dateStr} className={`card p-3 ${isToday ? "!border-forest ring-1 ring-forest/30" : ""}`}>
              <div className="flex items-baseline gap-2 lg:block">
                <p className="font-display text-base text-brick lg:text-sm">{format(day, "EEE")}</p>
                <p className="text-sm text-ink-light lg:text-xs">{format(day, "MMM d")}</p>
                {isToday && <p className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-forest lg:ml-0">Today</p>}
              </div>

              <div className="mt-3 space-y-3">
                {MEAL_TYPES.map((mealType) => {
                  const dayEntries = entries.filter((e) => e.date === dateStr && e.mealType === mealType);
                  const isPicking = pickerFor?.date === dateStr && pickerFor?.mealType === mealType;
                  const isEmpty = dayEntries.length === 0 && !isPicking;
                  return (
                    // Empty meals are hidden below large screens; the chips below replace them.
                    <div key={mealType} className={isEmpty ? "hidden lg:block" : ""}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-light lg:text-[10px]">{mealType}</p>
                      <div className="mt-1 space-y-1">
                        {dayEntries.map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded-md bg-linen-100 py-1 pl-2 text-sm lg:py-0.5 lg:text-xs">
                            <Link href={`/recipes/${e.recipe.id}`} className="min-w-0 truncate py-1 hover:underline">
                              {e.recipe.title}
                              {e.scale !== 1 && <span className="measure ml-1 text-[10px]">{e.scale === 0.5 ? "½×" : `${e.scale}×`}</span>}
                            </Link>
                            <button
                              onClick={() => removeEntry(e.id)}
                              aria-label={`Remove ${e.recipe.title}`}
                              className="flex h-8 w-8 shrink-0 items-center justify-center text-ink-light hover:text-brick lg:h-6 lg:w-6"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {isPicking ? (
                          <div className="rounded-md border border-linen-400 bg-white p-2">
                            <input
                              autoFocus
                              className="input lg:!py-1 lg:text-xs"
                              placeholder="Search recipes…"
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                            />
                            <div className="mt-1 max-h-56 overflow-y-auto lg:max-h-32">
                              {filteredRecipes.slice(0, 8).map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => addEntry(dateStr, mealType, r.id)}
                                  className="block w-full truncate rounded px-2 py-2 text-left text-sm hover:bg-linen-100 lg:px-1 lg:py-1 lg:text-xs"
                                >
                                  {r.title}
                                </button>
                              ))}
                              {filteredRecipes.length === 0 && <p className="px-1 py-1 text-sm text-ink-light lg:text-xs">No matches.</p>}
                            </div>
                            <button
                              className="mt-1 px-1 py-2 text-xs text-ink-light hover:underline lg:py-0 lg:text-[10px]"
                              onClick={() => setPickerFor(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openPicker(dateStr, mealType)}
                            className="w-full rounded-md border border-dashed border-linen-400 py-2 text-xs text-ink-light hover:border-forest hover:text-forest lg:py-1 lg:text-[10px]"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {emptyTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 lg:hidden">
                    {emptyTypes.map((mealType) => (
                      <button
                        key={mealType}
                        onClick={() => openPicker(dateStr, mealType)}
                        className="rounded-full border border-dashed border-linen-400 px-3 py-1.5 text-xs text-ink-light hover:border-forest hover:text-forest"
                      >
                        + {mealType}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
