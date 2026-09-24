"use client";

import { useEffect, useState } from "react";
import { ShareSettings } from "@/components/ShareSettings";
import { ListLinkSettings } from "@/components/ListLinkSettings";
import PushAlertsButton from "./PushAlertsButton";

interface BackfillResult {
  checked: number;
  updated: number;
  stillMissing: number;
  failed: number;
  failedTitles: string[];
  remainingCount: number;
}


interface CategoryBackfillResult {
  checked: number;
  updated: number;
  skipped: number;
  remainingCount: number;
}

export default function SettingsPage() {
  const [household, setHousehold] = useState<{ name: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResults, setBackfillResults] = useState<BackfillResult[]>([]);

  const [categoryBackfillRunning, setCategoryBackfillRunning] = useState(false);
  const [categoryBackfillResults, setCategoryBackfillResults] = useState<CategoryBackfillResult[]>([]);

  useEffect(() => {
    fetch("/api/household").then(async (res) => {
      if (!res.ok) {
        setError("Couldn't load household info.");
        return;
      }
      const json = await res.json();
      setHousehold(json.household);
    });
  }, []);

  async function handleCopy() {
    if (!household) return;
    await navigator.clipboard.writeText(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleBackfill() {
    setBackfillRunning(true);
    try {
      const res = await fetch("/api/recipes/backfill-times", { method: "POST" });
      const json: BackfillResult = await res.json();
      setBackfillResults((prev) => [...prev, json]);
    } finally {
      setBackfillRunning(false);
    }
  }


  async function handleCategoryBackfill() {
    setCategoryBackfillRunning(true);
    try {
      const res = await fetch("/api/recipes/backfill-categories", { method: "POST" });
      const json: CategoryBackfillResult = await res.json();
      setCategoryBackfillResults((prev) => [...prev, json]);
    } finally {
      setCategoryBackfillRunning(false);
    }
  }

  const totals = backfillResults.reduce(
    (acc, r) => ({
      checked: acc.checked + r.checked,
      updated: acc.updated + r.updated,
      stillMissing: acc.stillMissing + r.stillMissing,
      failed: acc.failed + r.failed,
      failedTitles: [...acc.failedTitles, ...r.failedTitles],
    }),
    { checked: 0, updated: 0, stillMissing: 0, failed: 0, failedTitles: [] as string[] }
  );
  const lastResult = backfillResults[backfillResults.length - 1];
  const hasMore = lastResult ? lastResult.remainingCount > 0 : false;
  const hasRunAtLeastOnce = backfillResults.length > 0;

  const categoryTotals = categoryBackfillResults.reduce(
    (acc, r) => ({ checked: acc.checked + r.checked, updated: acc.updated + r.updated, skipped: acc.skipped + r.skipped }),
    { checked: 0, updated: 0, skipped: 0 }
  );
  const lastCategoryResult = categoryBackfillResults[categoryBackfillResults.length - 1];
  const categoryHasMore = lastCategoryResult ? lastCategoryResult.remainingCount > 0 : false;
  const categoryHasRunAtLeastOnce = categoryBackfillResults.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-ink">Settings</h1>

      {error && <p className="mt-4 text-sm text-brick">{error}</p>}

      {household && (
        <div className="card mt-6 p-6">
          <p className="label">Household name</p>
          <p className="font-display text-xl text-ink">{household.name}</p>

          <p className="label mt-6">Invite code</p>
          <p className="mt-1 text-sm text-ink-light">
            Share this with family members — they can use it on the register page under "Join with a code" to join your recipe box.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <p className="rounded-md bg-forest-50 px-4 py-3 font-mono text-lg tracking-widest text-forest-dark">
              {household.inviteCode}
            </p>
            <button onClick={handleCopy} className="btn-secondary">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <ShareSettings />
      </div>
      <div className="mt-6">
        <ListLinkSettings />
      </div>
      <div className="mt-6">
        <PushAlertsButton />
      </div>

      <div className="card mt-6 p-6">
        <p className="label">Maintenance</p>
        <p className="font-display text-xl text-ink">Backfill cooking times</p>
        <p className="mt-1 text-sm text-ink-light">
          Re-checks recipes that were imported from a link but have no prep, cook, or total time saved
          (for example, ones imported before that data was supported). This only fills in missing
          time fields — it won't touch anything else about the recipe, and it skips anything you've
          already edited by hand. Recipes added by screenshot or entered manually have no link to
          re-check, so they aren't included.
        </p>

        <button onClick={handleBackfill} disabled={backfillRunning} className="btn-primary mt-4">
          {backfillRunning ? "Checking recipes…" : hasRunAtLeastOnce ? "Check more" : "Run backfill"}
        </button>

        {hasRunAtLeastOnce && (
          <div className="mt-4 rounded-md bg-linen-100 p-4 text-sm">
            <p>
              Checked <strong>{totals.checked}</strong> recipe{totals.checked === 1 ? "" : "s"} —{" "}
              <strong>{totals.updated}</strong> updated with new times.
            </p>
            {totals.stillMissing > 0 && (
              <p className="mt-1 text-ink-light">
                {totals.stillMissing} still had no time info on the source page.
              </p>
            )}
            {totals.failed > 0 && (
              <p className="mt-1 text-ink-light">
                {totals.failed} couldn't be re-fetched (the site may be blocking automated requests — screenshot import is the fallback for those): {totals.failedTitles.join(", ")}
              </p>
            )}
            {hasMore && (
              <p className="mt-2 text-ink-light">
                {lastResult.remainingCount} more recipe{lastResult.remainingCount === 1 ? "" : "s"} left to check — click "Check more" to continue.
              </p>
            )}
                        {!hasMore && (
              <p className="mt-2 font-semibold text-forest-dark">All caught up — nothing left to check.</p>
            )}
          </div>
        )}
      </div>

      <div className="card mt-6 p-6">
        <p className="label">Maintenance</p>
        <p className="font-display text-xl text-ink">Clean up categories &amp; tags</p>
        <p className="mt-1 text-sm text-ink-light">
          Some sites publish messy category data (e.g. "Dinner, Main Course, Poultry" all jammed into one field).
          This finds recipes with a category that doesn't match your standard list, picks the right one, and turns
          any leftover terms into proper, editable tags. Safe to run more than once.
        </p>

        <button onClick={handleCategoryBackfill} disabled={categoryBackfillRunning} className="btn-primary mt-4">
          {categoryBackfillRunning ? "Checking recipes…" : categoryHasRunAtLeastOnce ? "Check more" : "Run cleanup"}
        </button>

        {categoryHasRunAtLeastOnce && (
          <div className="mt-4 rounded-md bg-linen-100 p-4 text-sm">
            <p>
              Checked <strong>{categoryTotals.checked}</strong> recipe{categoryTotals.checked === 1 ? "" : "s"} —{" "}
              <strong>{categoryTotals.updated}</strong> cleaned up.
            </p>
            {categoryTotals.skipped > 0 && (
              <p className="mt-1 text-ink-light">
                {categoryTotals.skipped} had a category we couldn't match to anything useful and were left as-is.
              </p>
            )}
            {categoryHasMore && (
              <p className="mt-2 text-ink-light">
                {lastCategoryResult.remainingCount} more recipe{lastCategoryResult.remainingCount === 1 ? "" : "s"} left to check — click "Check more" to continue.
              </p>
            )}
            {!categoryHasMore && (
              <p className="mt-2 font-semibold text-forest-dark">All caught up — nothing left to check.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}