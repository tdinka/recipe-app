"use client";

import { useEffect, useState } from "react";

export function ShareSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/household/share").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.shareEnabled);
        setToken(data.shareToken);
      }
      setLoading(false);
    });
  }, []);

  async function callApi(action: "enable" | "disable" | "regenerate") {
    setBusy(true);
    try {
      const res = await fetch("/api/household/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.shareEnabled);
        setToken(data.shareToken);
        setCopied(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <p className="text-sm text-ink-light">Loading…</p>;
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${token}` : "";

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg text-ink">Public sharing</h2>
      <p className="mt-1 text-sm text-ink-light">
        Share a read-only link to your recipe collection. Anyone with the link can view it — no login required.
      </p>

      <div className="mt-4 flex items-center gap-3">
                <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={() => callApi(enabled ? "disable" : "enable")}
          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 p-0 transition-colors focus:outline-none ${
            enabled ? "bg-forest" : "bg-linen-300"
          } ${busy ? "opacity-60" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-linen-50 shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-sm text-ink">
          {enabled ? "Public link is on" : "Public link is off"}
        </span>
      </div>

      {enabled && (
        <div className="mt-4">
          <label className="label">Share link</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input readOnly value={shareUrl} className="input flex-1 min-w-0 text-sm" onFocus={(e) => e.target.select()} />
            <button onClick={copyLink} className="btn-ghost">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <button
            disabled={busy}
            onClick={() => {
              if (confirm("This will invalidate the current link — anyone using the old one will lose access. Continue?")) {
                callApi("regenerate");
              }
            }}
            className="mt-3 text-sm text-brick hover:underline disabled:opacity-60"
          >
            Regenerate link
          </button>
        </div>
      )}
    </div>
  );
}
