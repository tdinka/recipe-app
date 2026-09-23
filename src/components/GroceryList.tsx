"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_STORE, SECTIONS, STORE_IDS, STORE_LABELS, isSection, type StoreId } from "@/lib/grocery";

interface Item {
  id: string;
  name: string;
  quantity: string | null;
  section: string;
  store: string;
}
interface PastItem extends Item {
  timesBought: number;
}
type ItemChanges = Partial<Pick<Item, "quantity" | "store" | "section">>;
type View = StoreId | "all";

const POLL_MS = 4000; // how often to check for changes made on other phones
const UNDO_MS = 5000; // how long "Undo" stays available after checking something off
const JSON_HEADERS = { "Content-Type": "application/json" };

function groupBySection(list: Item[]) {
  return SECTIONS.map((section) => ({
    section,
    items: list
      .filter((i) => (isSection(i.section) ? i.section : "Other") === section)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

export function GroceryList({ token, householdName }: { token: string; householdName: string }) {
  const api = `/api/list/${token}`;

  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("all");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Item[]>([]); // checked off, still undoable
  const [showPast, setShowPast] = useState(false);
  const [pastItems, setPastItems] = useState<PastItem[]>([]);
  const [pastQuery, setPastQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = useRef(0); // skip refreshes while a change is saving, so edits don't flicker
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nameInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (busy.current > 0) return;
    try {
      const res = await fetch(api, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      if (busy.current > 0) return;
      setItems(json.items ?? []);
      setLoaded(true);
      setError(null);
    } catch {
      setError("Can't reach the list right now. Retrying…");
    }
  }, [api]);

  const sendPurchase = useCallback(
    async (id: string) => {
      timers.current.delete(id);
      setPending((p) => p.filter((i) => i.id !== id));
      setItems((prev) => prev.filter((i) => i.id !== id));
      busy.current++;
      try {
        await fetch(`${api}/items/${id}/purchase`, { method: "POST" });
      } finally {
        busy.current--;
      }
    },
    [api]
  );

  // Keep the list fresh, and save checked-off items right away if the phone
  // is locked or the tab is closed during the Undo window.
  useEffect(() => {
    const flush = () => {
      const ids = Array.from(timers.current.keys());
      if (ids.length === 0) return;
      timers.current.forEach((timer, id) => {
        clearTimeout(timer);
        navigator.sendBeacon(`${api}/items/${id}/purchase`);
      });
      timers.current.clear();
      setPending([]);
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
      else flush();
    };

    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [api, load]);

  async function save(request: () => Promise<Response>) {
    busy.current++;
    try {
      const res = await request();
      if (!res.ok) throw new Error("save failed");
      setError(null);
      return res;
    } catch {
      setError("That didn't save. Check your connection and try again.");
      return null;
    } finally {
      busy.current--;
    }
  }

  async function addItem(payload: { name: string; quantity: string | null; store: string; section?: string }) {
    const res = await save(() =>
      fetch(api, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload) })
    );
    if (!res) return;
    const { item } = await res.json();
    setItems((prev) =>
      prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]
    );
  }

  // In the "All" view, new items go to the default store (Vons).
  const addStore: StoreId = view === "all" ? DEFAULT_STORE : view;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addItem({ name: trimmed, quantity: qty.trim() || null, store: addStore });
    setName("");
    setQty("");
    nameInput.current?.focus();
  }

  function updateItem(id: string, changes: ItemChanges) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    save(() =>
      fetch(`${api}/items/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(changes) })
    );
  }

  function removeItem(id: string) {
    setEditingId(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
    save(() => fetch(`${api}/items/${id}`, { method: "DELETE" }));
  }

  function buy(item: Item) {
    setEditingId(null);
    setPending((p) => [...p, item]);
    timers.current.set(item.id, setTimeout(() => sendPurchase(item.id), UNDO_MS));
  }

  function undo(item: Item) {
    const timer = timers.current.get(item.id);
    if (timer) clearTimeout(timer);
    timers.current.delete(item.id);
    setPending((p) => p.filter((i) => i.id !== item.id));
  }

  async function openPast() {
    setShowPast(true);
    setPastQuery("");
    const res = await fetch(`${api}/archive`, { cache: "no-store" });
    if (res.ok) setPastItems((await res.json()).items ?? []);
  }

  function forgetPast(id: string) {
    setPastItems((prev) => prev.filter((p) => p.id !== id));
    save(() => fetch(`${api}/archive/${id}`, { method: "DELETE" }));
  }

  function switchView(next: View) {
    setView(next);
    setEditingId(null);
    window.scrollTo({ top: 0 });
  }

  const pendingIds = new Set(pending.map((i) => i.id));
  const visible = items.filter((i) => !pendingIds.has(i.id));
  const countFor = (id: StoreId) => visible.filter((i) => i.store === id).length;
  const storesToShow: StoreId[] = view === "all" ? STORE_IDS.filter((id) => countFor(id) > 0) : [view];
  const tabs: { id: View; label: string; count: number }[] = [
    { id: "all", label: "All", count: visible.length },
    ...STORE_IDS.map((id) => ({ id, label: STORE_LABELS[id], count: countFor(id) })),
  ];
  const lastBought = pending[pending.length - 1];
  const onListNames = new Set(visible.map((i) => i.name.trim().toLowerCase()));
  const query = pastQuery.trim().toLowerCase();
  const filteredPast = query ? pastItems.filter((p) => p.name.toLowerCase().includes(query)) : pastItems;

  const isEmpty = view === "all" ? visible.length === 0 : countFor(view) === 0;

  return (
    <div className="mx-auto max-w-xl pb-28">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label">{householdName}</p>
          <h1 className="font-display text-3xl text-ink">Grocery List</h1>
        </div>
        <button onClick={openPast} className="btn-secondary shrink-0">
          ↺ Past items
        </button>
      </div>

      <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = tab.id === view;
          return (
            <button
              key={tab.id}
              onClick={() => switchView(tab.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                active ? "bg-forest text-white" : "bg-linen-100 text-ink"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 ${active ? "opacity-80" : "text-ink-light"}`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex gap-2">
        <input
          ref={nameInput}
          className="input flex-1"
          placeholder={`Add to ${STORE_LABELS[addStore]}…`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          enterKeyHint="done"
          autoComplete="off"
        />
        <input
          className="input w-20"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn-primary shrink-0">
          Add
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-brick">{error}</p>}

      {loaded && isEmpty && (
        <p className="py-10 text-center text-ink-light">
          {view === "all" ? "The list is empty 🎉" : `Nothing on the ${STORE_LABELS[view]} list 🎉`}
        </p>
      )}

      <div className="mt-6 space-y-10">
        {storesToShow.map((storeId) => {
          const groups = groupBySection(visible.filter((i) => i.store === storeId));
          if (groups.length === 0) return null;
          return (
            <div key={storeId}>
              {view === "all" && (
                <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-2">
                  <h2 className="font-display text-2xl text-ink">
                    {STORE_LABELS[storeId]}
                    <span className="ml-2 text-sm text-ink-light">{countFor(storeId)}</span>
                  </h2>
                  <button onClick={() => switchView(storeId)} className="text-sm font-medium text-forest-dark">
                    Shop →
                  </button>
                </div>
              )}
              <div className="space-y-6">
                {groups.map(({ section, items: sectionItems }) => (
                  <section key={section}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{section}</p>
                    <ul className="mt-1 divide-y divide-black/5">
                      {sectionItems.map((item) => (
                        <li key={item.id}>
                          <div className="flex items-center gap-3 py-3">
                            <button
                              aria-label={`Mark ${item.name} as bought`}
                              onClick={() => buy(item)}
                              className="h-7 w-7 shrink-0 rounded-full border-2 border-forest transition hover:bg-forest-50"
                            />
                            <button
                              onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                              className="flex flex-1 items-baseline gap-2 text-left"
                            >
                              <span className="text-lg text-ink">{item.name}</span>
                              {item.quantity && <span className="measure text-sm">{item.quantity}</span>}
                            </button>
                          </div>
                          {editingId === item.id && (
                            <ItemEditor
                              item={item}
                              onChange={(changes) => updateItem(item.id, changes)}
                              onRemove={() => removeItem(item.id)}
                              onClose={() => setEditingId(null)}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {lastBought && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-full bg-ink px-5 py-3 text-sm text-white shadow-lg">
            <span>
              ✓ Bought {lastBought.name}
              {pending.length > 1 ? ` +${pending.length - 1} more` : ""}
            </span>
            <button onClick={() => undo(lastBought)} className="font-semibold underline">
              Undo
            </button>
          </div>
        </div>
      )}

      {showPast && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setShowPast(false)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] max-w-xl flex-col rounded-t-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink">Past items</h2>
              <button onClick={() => setShowPast(false)} className="font-medium text-ink-light">
                Done
              </button>
            </div>
            <input
              className="input mt-3"
              placeholder="Search…"
              value={pastQuery}
              onChange={(e) => setPastQuery(e.target.value)}
              autoComplete="off"
            />
            <ul className="mt-3 flex-1 divide-y divide-black/5 overflow-y-auto">
              {filteredPast.length === 0 && (
                <li className="py-6 text-center text-sm text-ink-light">
                  {pastItems.length === 0 ? "Items you check off will show up here." : "No matches."}
                </li>
              )}
              {filteredPast.map((p) => {
                const onList = onListNames.has(p.name.trim().toLowerCase());
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <button
                      onClick={() => forgetPast(p.id)}
                      aria-label={`Remove ${p.name} from past items`}
                      className="px-1 text-xs text-ink-light hover:text-brick"
                    >
                      ✕
                    </button>
                    <div className="flex-1">
                      <p className="text-ink">{p.name}</p>
                      <p className="text-xs text-ink-light">
                        {STORE_LABELS[p.store as StoreId] ?? p.store} · {p.section} · bought {p.timesBought}×
                      </p>
                    </div>
                    {onList ? (
                      <span className="text-xs text-forest-dark">On list ✓</span>
                    ) : (
                      <button
                        onClick={() =>
                          addItem({
                            name: p.name,
                            quantity: p.quantity,
                            store: p.store,
                            section: isSection(p.section) ? p.section : undefined,
                          })
                        }
                        className="btn-primary shrink-0"
                      >
                        + Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemEditor({
  item,
  onChange,
  onRemove,
  onClose,
}: {
  item: Item;
  onChange: (changes: ItemChanges) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(item.quantity ?? "");

  function saveQty() {
    const next = qty.trim() || null;
    if (next !== item.quantity) onChange({ quantity: next });
  }

  return (
    <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-linen-100 p-3 text-sm">
      <label className="col-span-2">
        <span className="label">Quantity</span>
        <input
          className="input"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={saveQty}
          placeholder="e.g. 2, 1 dozen, 3 lb"
        />
      </label>
      <label>
        <span className="label">Store</span>
        <select className="input" value={item.store} onChange={(e) => onChange({ store: e.target.value })}>
          {STORE_IDS.map((id) => (
            <option key={id} value={id}>
              {STORE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Section</span>
        <select
          className="input"
          value={isSection(item.section) ? item.section : "Other"}
          onChange={(e) => onChange({ section: e.target.value })}
        >
          {SECTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="col-span-2 flex items-center justify-between">
        <button onClick={onRemove} className="text-brick">
          Remove from list
        </button>
        <button
          onClick={() => {
            saveQty();
            onClose();
          }}
          className="btn-secondary"
        >
          Done
        </button>
      </div>
    </div>
  );
}
