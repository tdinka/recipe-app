"use client";

import { useState } from "react";
import Image from "next/image";
import type { UnsplashPhoto } from "@/lib/unsplash";

export interface SelectedPhoto {
  url: string;
  attributionName: string;
  attributionUrl: string;
}

export function PhotoPicker({
  initialQuery,
  onSelect,
  onClose,
}: {
  initialQuery: string;
  onSelect: (photo: SelectedPhoto) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UnsplashPhoto[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/images/unsplash-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Couldn't search for photos.");
        return;
      }
      setResults(json.results ?? []);
    } catch {
      setError("Couldn't search for photos. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(photo: UnsplashPhoto) {
    // Required by Unsplash's guidelines: ping this when a photo is actually used.
    fetch("/api/images/unsplash-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
    }).catch(() => {});

    onSelect({
      url: photo.regularUrl,
      attributionName: photo.photographerName,
      attributionUrl: photo.unsplashPhotoUrl,
    });
  }

  return (
    <div className="card mt-3 p-4">
      <div className="flex items-center justify-between">
        <p className="label">Find a photo on Unsplash</p>
        <button type="button" onClick={onClose} className="text-xs text-ink-light hover:underline">Close</button>
      </div>
      <form onSubmit={handleSearch} className="mt-2 flex gap-2">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. spaghetti carbonara"
        />
        <button type="submit" disabled={loading} className="btn-secondary shrink-0">
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-brick">{error}</p>}

      {results && results.length === 0 && !error && (
        <p className="mt-3 text-sm text-ink-light">No photos found for that search — try a different term.</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {results.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => handleSelect(photo)}
              className="group text-left"
            >
              <div className="relative h-24 w-full overflow-hidden rounded-md border border-linen-300">
                <Image
                  src={photo.thumbUrl}
                  alt={`Photo by ${photo.photographerName}`}
                  fill
                  sizes="150px"
                  className="object-cover transition-transform group-hover:scale-105"
                  unoptimized
                />
              </div>
              <p className="mt-1 truncate text-[10px] text-ink-light">by {photo.photographerName}</p>
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] text-ink-light">
        Photos via{" "}
        <a href="https://unsplash.com/?utm_source=family-recipe-box&utm_medium=referral" target="_blank" rel="noreferrer" className="underline">
          Unsplash
        </a>
      </p>
    </div>
  );
}
