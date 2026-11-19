"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SECTIONS, isSection } from "@/lib/grocery";

interface PantryItem {
  id: string;
  name: string;
  section: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// What's already in the house. Lives inside the family grocery list, so anyone
// with the list link can keep it up to date. "What can I make?" reads it.
export function PantryPanel({ token, onAddedToList }: { token: string; onAddedToList: () => void }) {
  const api = `/api/list/${token}`;
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${api}/pantry`, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      setItems((await res.json()).items ?? []);
      setLoaded(true);
      setError(null);
    } catch {
      setError("Can't reach the pantry right now. Check your connection.");
    }
  }, [api]);

  useEffect(() => {
    load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  function showToast(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    input.current?.focus();
    const res = await fetch(`${api}/pantry`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ text: trimmed }) });
    if (!res.ok) {
      setError("That didn't save. Check your connection and try again.");
      setText(trimmed);
      return;
    }
    const added: PantryItem[] = (await res.json()).items ?? [];
    setItems((prev) => {
      const ids = new Set(prev.map((i) => i.id));
      return [...prev, ...added.filter((i) => !ids.has(i.id))];
    });
    setError(null);
  }

  async function remove(item: PantryItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await fetch(`${api}/pantry/${item.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("That didn't save. Check your connection and try again.");
      load();
    }
  }

  // Ran out: put it on the shopping list and take it out of the pantry.
  async function moveToList(item: PantryItem) {
    const res = await fetch(api, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: item.name, quantity: null, ...(isSection(item.section) ? { section: item.section } : {}) }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't add that to the list. Try again.");
      return;
    }
    await remove(item);
    onAddedToList();
    showToast(`Added ${item.name} to the list`);
  }

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  const groups = SECTIONS.map((section) => ({
    section,
    items: shown
      .filter((i) => (isSection(i.section) ? i.section : "Other") === section)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <p className="mt-4 text-sm text-ink-light">
        What&apos;s already in the fridge, freezer and cupboards. &ldquo;What can I make?&rdquo; uses this list.
      </p>

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          ref={input}
          className="input flex-1"
          placeholder="Add, e.g. rice, 2 lb chicken thighs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary shrink-0">
          Add
        </button>
      </form>

      {items.length > 8 && (
        <input
          type="search"
          className="input mt-2"
          placeholder="Search the pantry…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      )}

      {error && <p className="mt-3 text-sm text-brick">{error}</p>}

      {loaded && items.length === 0 && (
        <p className="py-10 text-center text-ink-light">
          Nothing here yet. Add what you have, separated by commas.
        </p>
      )}
      {loaded && items.length > 0 && shown.length === 0 && (
        <p className="py-10 text-center text-ink-light">No matches.</p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map(({ section, items: sectionItems }) => (
          <section key={section}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
              {section === "Pantry" ? "Cupboard" : section}
            </p>
            <ul className="mt-1 divide-y divide-black/5">
              {sectionItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-2.5">
                  <span className="flex-1 text-lg text-ink">{item.name}</span>
                  <button
                    onClick={() => moveToList(item)}
                    className="shrink-0 rounded-full bg-linen-100 px-3 py-1.5 text-xs font-medium text-ink"
                    aria-label={`Ran out of ${item.name}: add it to the shopping list`}
                  >
                    🛒 Ran out
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="shrink-0 rounded-full px-2 py-1.5 text-sm text-ink-light hover:text-brick"
                    aria-label={`Remove ${item.name} from the pantry`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="rounded-full bg-ink px-5 py-3 text-sm text-white shadow-lg">✓ {toast}</div>
        </div>
      )}
    </div>
  );
}
