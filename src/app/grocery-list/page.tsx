"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { format, startOfWeek, addDays } from "date-fns";

interface GroceryItem {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  source: string;
}

export default function GroceryListPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [generating, setGenerating] = useState(false);

  const defaultStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const defaultEnd = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), "yyyy-MM-dd");
  const [rangeStart, setRangeStart] = useState(searchParams.get("start") ?? defaultStart);
  const [rangeEnd, setRangeEnd] = useState(searchParams.get("end") ?? defaultEnd);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/grocery-list");
    const json = await res.json();
    setItems(json.items ?? []);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  // If we arrived from the meal plan with a date range, generate automatically.
  useEffect(() => {
    if (searchParams.get("start") && searchParams.get("end")) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generateFrom: { start: rangeStart, end: rangeEnd } }),
    });
    const json = await res.json();
    setItems(json.items ?? []);
    setGenerating(false);
  }

  async function toggleItem(id: string, checked: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked } : i)));
    await fetch(`/api/grocery-list/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/grocery-list/${id}`, { method: "DELETE" });
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualName.trim()) return;
    const res = await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: manualName, quantity: manualQty || null }),
    });
    const json = await res.json();
    setItems((prev) => [...prev, json.item]);
    setManualName("");
    setManualQty("");
  }

  async function clearChecked() {
    await fetch("/api/grocery-list", { method: "DELETE" });
    loadItems();
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-ink">Grocery List</h1>

      <div className="card mt-6 p-5">
        <p className="label">Build from meal plan</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </div>
          <button onClick={handleGenerate} disabled={generating} className="btn-secondary">
            {generating ? "Building…" : "Generate list"}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-light">
          This pulls ingredients from every meal planned in that range and combines duplicates. Manually added items are kept.
        </p>
      </div>

      <form onSubmit={addManual} className="mt-4 flex gap-2">
        <input className="input" placeholder="Add an item…" value={manualName} onChange={(e) => setManualName(e.target.value)} />
        <input className="input w-32" placeholder="Qty" value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
        <button type="submit" className="btn-primary shrink-0">Add</button>
      </form>

      <div className="mt-6 space-y-1">
        {unchecked.length === 0 && checked.length === 0 && (
          <p className="text-sm text-ink-light">Your list is empty. Add items or generate from your meal plan.</p>
        )}
        {unchecked.map((item) => (
          <label key={item.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-linen-100">
            <span className="flex items-center gap-3">
              <input type="checkbox" checked={item.checked} onChange={(e) => toggleItem(item.id, e.target.checked)} className="h-4 w-4 accent-forest" />
              <span>{item.name}</span>
              {item.quantity && <span className="measure text-xs">{item.quantity}</span>}
            </span>
            <button type="button" onClick={() => removeItem(item.id)} className="text-xs text-ink-light hover:text-brick">✕</button>
          </label>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">Checked off</p>
            <button onClick={clearChecked} className="text-xs text-ink-light hover:text-brick">Clear checked</button>
          </div>
          <div className="mt-1 space-y-1">
            {checked.map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-ink-light line-through">
                <input type="checkbox" checked={item.checked} onChange={(e) => toggleItem(item.id, e.target.checked)} className="h-4 w-4 accent-forest" />
                <span>{item.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
