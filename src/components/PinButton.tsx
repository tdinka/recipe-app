"use client";

import { useState } from "react";

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

// Pins a recipe to the top of the recipe box. "overlay" is the round button on a
// recipe card's photo; "button" is the labelled one on the recipe page.
export function PinButton({
  recipeId,
  pinned,
  onChange,
  variant = "button",
}: {
  recipeId: string;
  pinned: boolean;
  onChange?: (pinned: boolean) => void;
  variant?: "overlay" | "button";
}) {
  const [isPinned, setIsPinned] = useState(pinned);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !isPinned;
    setIsPinned(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (!res.ok) throw new Error("pin failed");
      onChange?.(next);
    } catch {
      setIsPinned(!next);
      alert("Couldn't update the pin. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const label = isPinned ? "Unpin recipe" : "Pin to top";

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-label={label}
        aria-pressed={isPinned}
        title={label}
        className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${
          isPinned ? "bg-mustard text-ink" : "bg-white/85 text-ink-light hover:text-ink"
        }`}
      >
        <PinIcon filled={isPinned} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={isPinned}
      className={`btn-ghost inline-flex items-center gap-1.5 ${isPinned ? "text-mustard-dark" : ""}`}
    >
      <PinIcon filled={isPinned} />
      {isPinned ? "Pinned" : "Pin"}
    </button>
  );
}
