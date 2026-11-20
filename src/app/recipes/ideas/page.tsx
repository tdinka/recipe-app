"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, startOfWeek } from "date-fns";
import type { RecipeIdea } from "@/lib/recipe-ideas";
import { IDEA_DRAFT_KEY } from "@/lib/constants";

interface PantryItem {
  id: string;
  name: string;
}

type PartStatus = "idle" | "loading" | "done" | "error";

// Everything on the page, kept in sessionStorage so going Back from a recipe
// brings the same ideas up again instead of starting over.
interface SavedState {
  unticked: string[];
  extra: string;
  protein: string;
  note: string;
  quickIdeas: RecipeIdea[];
  webIdeas: RecipeIdea[];
  seen: string[];
  redMeatLimitReached: boolean;
  redMeatDays: number;
}

const STORAGE_KEY = "recipeIdeasState";
const PROTEINS = ["Chicken", "Turkey", "Salmon", "White fish", "Shrimp", "Eggs", "Tofu", "Beans", "Beef", "Pork"];

function loadSaved(): SavedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedState) : null;
  } catch {
    return null;
  }
}

function splitList(text: string) {
  return text
    .split(/\n|,|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function RecipeIdeasPage() {
  const router = useRouter();
  const [pantry, setPantry] = useState<PantryItem[] | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [protein, setProtein] = useState("");
  const [note, setNote] = useState("");

  const [quickIdeas, setQuickIdeas] = useState<RecipeIdea[]>([]);
  const [webIdeas, setWebIdeas] = useState<RecipeIdea[]>([]);
  const [quickStatus, setQuickStatus] = useState<PartStatus>("idle");
  const [webStatus, setWebStatus] = useState<PartStatus>("idle");
  const [quickError, setQuickError] = useState<string | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [redMeat, setRedMeat] = useState({ days: 0, limitReached: false });
  const [formError, setFormError] = useState<string | null>(null);
  const restored = useRef(false);
  const requestId = useRef(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setUnticked(new Set(saved.unticked));
      setExtra(saved.extra);
      setProtein(saved.protein);
      setNote(saved.note);
      setQuickIdeas(saved.quickIdeas);
      setWebIdeas(saved.webIdeas);
      setSeen(saved.seen);
      setRedMeat({ days: saved.redMeatDays, limitReached: saved.redMeatLimitReached });
      if (saved.quickIdeas.length) setQuickStatus("done");
      if (saved.webIdeas.length) setWebStatus("done");
    }
    restored.current = true;
    fetch("/api/pantry")
      .then((r) => r.json())
      .then((json) => setPantry(json.items ?? []))
      .catch(() => setPantry([]));
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    const state: SavedState = {
      unticked: Array.from(unticked),
      extra,
      protein,
      note,
      quickIdeas,
      webIdeas,
      seen,
      redMeatLimitReached: redMeat.limitReached,
      redMeatDays: redMeat.days,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing can block storage; the page still works without it.
    }
  }, [unticked, extra, protein, note, quickIdeas, webIdeas, seen, redMeat]);

  function toggle(name: string) {
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const have = [...(pantry ?? []).map((p) => p.name).filter((n) => !unticked.has(n)), ...splitList(extra)];
  const busy = quickStatus === "loading" || webStatus === "loading";

  async function fetchPart(part: "quick" | "web", body: Record<string, unknown>) {
    const res = await fetch("/api/recipes/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, part }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
    return json as { ideas: RecipeIdea[]; redMeatDays: number; redMeatLimitReached: boolean };
  }

  function getIdeas(fresh: boolean) {
    if (have.length === 0 && !protein.trim()) {
      setFormError("Tick or type at least one ingredient, or choose a protein.");
      return;
    }
    setFormError(null);
    const exclude = fresh ? [] : Array.from(new Set([...seen, ...quickIdeas.map((i) => i.title), ...webIdeas.map((i) => i.title)]));
    if (fresh) setSeen([]);
    else setSeen(exclude);

    const id = ++requestId.current;
    const body = {
      have,
      protein: protein.trim() || null,
      note: note.trim() || null,
      exclude: exclude.slice(-60),
      weekStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };

    setQuickIdeas([]);
    setWebIdeas([]);
    setQuickError(null);
    setWebError(null);
    setQuickStatus("loading");
    setWebStatus("loading");
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    fetchPart("quick", body)
      .then((r) => {
        if (id !== requestId.current) return;
        setQuickIdeas(r.ideas);
        setRedMeat({ days: r.redMeatDays, limitReached: r.redMeatLimitReached });
        setQuickStatus("done");
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setQuickError(err.message);
        setQuickStatus("error");
      });
    fetchPart("web", body)
      .then((r) => {
        if (id !== requestId.current) return;
        setWebIdeas(r.ideas);
        setWebStatus("done");
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setWebError(err.message);
        setWebStatus("error");
      });
  }

  function openIdea(idea: RecipeIdea) {
    if (idea.kind === "box" && idea.recipeId) {
      router.push(`/recipes/${idea.recipeId}`);
    } else if (idea.kind === "web" && idea.url) {
      // Saved so the add-recipe page can offer to have Claude write a version if the site blocks the import.
      try {
        sessionStorage.setItem(IDEA_DRAFT_KEY, JSON.stringify(idea));
      } catch {
        // Import still works without it.
      }
      // A full page load, so the add-recipe page reliably sees the address it was given.
      window.location.assign(`/recipes/new?importUrl=${encodeURIComponent(idea.url)}&fromIdea=1`);
    } else {
      try {
        sessionStorage.setItem(IDEA_DRAFT_KEY, JSON.stringify(idea));
      } catch {
        alert("Couldn't open that idea. Try again.");
        return;
      }
      window.location.assign("/recipes/new?fromIdea=1");
    }
  }

  // Box recipes first, then web, then AI. Drop web ideas that repeat an AI idea's title.
  const quickTitles = new Set(quickIdeas.map((i) => i.title.toLowerCase()));
  const ideas = [
    ...quickIdeas.filter((i) => i.kind === "box"),
    ...webIdeas.filter((i) => !quickTitles.has(i.title.toLowerCase())),
    ...quickIdeas.filter((i) => i.kind === "ai"),
  ];
  const started = quickStatus !== "idle" || webStatus !== "idle";

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <Link href="/recipes" className="text-xs text-ink-light hover:underline">
        ← Recipe box
      </Link>
      <h1 className="mt-1 font-display text-2xl text-ink sm:text-3xl">What can I make?</h1>
      <p className="mt-1 text-sm text-ink-light">
        Pick what you want to use. You&apos;ll get recipes from your box, real recipes from the web, and a couple
        of new ideas from Claude, following your{" "}
        <Link href="/settings" className="underline">
          food preferences
        </Link>
        .
      </p>

      <div className="card mt-5 space-y-5 p-5">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="label">From your pantry</p>
            <Link href="/grocery-list#pantry" className="text-xs text-forest-dark underline">
              Edit pantry
            </Link>
          </div>
          {pantry === null && <p className="text-sm text-ink-light">Loading…</p>}
          {pantry && pantry.length === 0 && (
            <p className="text-sm text-ink-light">
              Your pantry is empty. Type what you have below, or{" "}
              <Link href="/grocery-list#pantry" className="underline">
                fill in your pantry
              </Link>{" "}
              so it&apos;s ready next time.
            </p>
          )}
          {pantry && pantry.length > 0 && (
            <>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {pantry.map((p) => {
                  const on = !unticked.has(p.name);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.name)}
                      aria-pressed={on}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        on ? "bg-forest text-white" : "bg-linen-100 text-ink-light line-through"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-ink-light">Tap to leave something out.</p>
            </>
          )}
        </div>

        <label className="block">
          <span className="label">Anything else you have?</span>
          <input
            className="input"
            placeholder="e.g. half a cabbage, feta, limes"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            autoComplete="off"
          />
        </label>

        <div>
          <label className="block">
            <span className="label">Protein (optional)</span>
            <input
              className="input"
              placeholder="e.g. chicken thighs"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PROTEINS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProtein(protein === p ? "" : p)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  protein === p ? "bg-forest text-white" : "bg-linen-100 text-ink"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="label">Anything else? (optional)</span>
          <input
            className="input"
            placeholder="e.g. something Thai, under 30 minutes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoComplete="off"
          />
        </label>

        {formError && <p className="text-sm text-brick">{formError}</p>}
        <button onClick={() => getIdeas(true)} disabled={busy} className="btn-primary w-full">
          {busy ? "Getting ideas…" : "✨ Get ideas"}
        </button>
      </div>

      <div ref={resultsRef} className="scroll-mt-4">
        {redMeat.limitReached && quickStatus === "done" && (
          <p className="mt-5 rounded-md bg-linen-100 px-4 py-2.5 text-sm text-ink">
            🥩 This week&apos;s meal plan already has {redMeat.days} red meat days, so these ideas skip beef, lamb and
            pork.
          </p>
        )}

        {started && (
          <div className="mt-5 space-y-3">
            {quickStatus === "loading" && <LoadingCard text="Checking your recipe box and thinking up ideas…" />}
            {quickError && <p className="rounded-md bg-brick/10 px-4 py-2.5 text-sm text-brick">{quickError}</p>}

            {ideas.map((idea) => (
              <IdeaCard key={`${idea.kind}-${idea.title}`} idea={idea} onOpen={() => openIdea(idea)} />
            ))}

            {webStatus === "loading" && (
              <LoadingCard text="Searching the web for real recipes… this can take a minute or two." />
            )}
            {webError && (
              <p className="rounded-md bg-linen-100 px-4 py-2.5 text-sm text-ink-light">
                Web recipes: {webError}
              </p>
            )}

            {!busy && (quickStatus === "done" || webStatus === "done") && (
              <button onClick={() => getIdeas(false)} className="btn-secondary w-full">
                ↻ New ideas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="card flex items-center gap-3 p-4 text-sm text-ink-light">
      <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-linen-300 border-t-forest" />
      {text}
    </div>
  );
}

const BADGES = {
  box: { label: "In your box", className: "bg-forest-50 text-forest-dark" },
  web: { label: "From the web", className: "bg-mustard-50 text-mustard-dark" },
  ai: { label: "✨ New idea · untested", className: "bg-brick/10 text-brick" },
} as const;

const ACTIONS = { box: "Open recipe", web: "Import recipe", ai: "Write the full recipe" } as const;

function IdeaCard({ idea, onOpen }: { idea: RecipeIdea; onOpen: () => void }) {
  const badge = BADGES[idea.kind];
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${badge.className}`}>{badge.label}</span>
        {idea.site && <span className="text-ink-light">{idea.site}</span>}
        {idea.minutes && <span className="measure">{idea.minutes} min</span>}
      </div>
      <h2 className="mt-2 font-display text-lg leading-snug text-ink">{idea.title}</h2>
      {idea.description && <p className="mt-1 text-sm text-ink-light">{idea.description}</p>}
      {idea.uses.length > 0 && (
        <p className="mt-2 text-sm text-ink">
          <span className="text-ink-light">Uses:</span> {idea.uses.join(", ")}
        </p>
      )}
      <p className="mt-0.5 text-sm text-ink">
        <span className="text-ink-light">To buy:</span> {idea.toBuy.length > 0 ? idea.toBuy.join(", ") : "nothing 🎉"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={onOpen} className="btn-primary">
          {ACTIONS[idea.kind]} →
        </button>
        {idea.kind === "web" && idea.url && (
          <a href={idea.url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink-light underline">
            View on site ↗
          </a>
        )}
      </div>
    </div>
  );
}
