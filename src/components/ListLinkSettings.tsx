"use client";

import { useEffect, useState } from "react";

function toUrl(token: string) {
  return `${window.location.origin}/list/${token}`;
}

export function ListLinkSettings() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/household/list-link").then(async (res) => {
      if (!res.ok) {
        setError("Couldn't load the grocery list link.");
        return;
      }
      const json = await res.json();
      setUrl(toUrl(json.token));
    });
  }, []);

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleReset() {
    if (!confirm("Make a new link? The old one stops working, so you'll need to send the new link to everyone.")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/household/list-link", { method: "POST" });
      const json = await res.json();
      setUrl(toUrl(json.token));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="card p-6">
      <p className="label">Grocery list</p>
      <p className="font-display text-xl text-ink">Family list link</p>
      <p className="mt-1 text-sm text-ink-light">
        Anyone with this link can view and edit the grocery list, with no login needed. Text it to your family
        and have them add it to their phone&apos;s home screen.
      </p>
      {error && <p className="mt-3 text-sm text-brick">{error}</p>}
      {url && (
        <>
          <p className="mt-3 break-all rounded-md bg-forest-50 px-4 py-3 font-mono text-sm text-forest-dark">{url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={handleCopy} className="btn-primary">
              {copied ? "Copied!" : "Copy link"}
            </button>
            <a href={url} className="btn-secondary">
              Open list
            </a>
            <button onClick={handleReset} disabled={resetting} className="btn-secondary">
              {resetting ? "Resetting…" : "Reset link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
