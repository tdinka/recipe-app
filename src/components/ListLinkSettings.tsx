"use client";

import { useEffect, useState } from "react";

function toUrl(token: string) {
  return `${window.location.origin}/list/${token}`;
}

export function ListLinkSettings() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [siriCopied, setSiriCopied] = useState(false);
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

  // The address the "Add to Groceries" Siri Shortcut sends items to.
  const siriUrl = url ? url.replace("/list/", "/api/list/") + "/quick-add" : null;

  async function handleCopySiri() {
    if (!siriUrl) return;
    await navigator.clipboard.writeText(siriUrl);
    setSiriCopied(true);
    setTimeout(() => setSiriCopied(false), 2000);
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

          <div className="mt-6 border-t border-linen-300 pt-5">
            <p className="font-display text-lg text-ink">Add items with Siri</p>
            <p className="mt-1 text-sm text-ink-light">
              Say &ldquo;Hey Siri, Add to Groceries&rdquo;, then the items, like &ldquo;milk, bread and two
              avocados&rdquo;. Set this up once on each iPhone:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink">
              <li>
                Copy the Siri link below and send it to that phone (for example, text it to yourself).
              </li>
              <li>
                Open the <strong>Shortcuts</strong> app, tap <strong>+</strong>, and name the shortcut{" "}
                <strong>Add to Groceries</strong>.
              </li>
              <li>
                Add the action <strong>Ask for Input</strong>. Set the prompt to &ldquo;What should I add?&rdquo;
              </li>
              <li>
                Add the action <strong>Get Contents of URL</strong> and paste the Siri link as the URL. Tap the
                arrow to show more: set <strong>Method</strong> to <strong>POST</strong>, <strong>Request Body</strong>{" "}
                to <strong>Form</strong>, then add a text field with the key <code>text</code> and the value{" "}
                <strong>Provided Input</strong>.
              </li>
              <li>
                Add the action <strong>Show Result</strong> (it picks <strong>Contents of URL</strong>), so Siri
                tells you what was added.
              </li>
              <li>Tap <strong>Done</strong>, then try it: &ldquo;Hey Siri, Add to Groceries&rdquo;.</li>
            </ol>
            {siriUrl && (
              <>
                <p className="mt-3 break-all rounded-md bg-forest-50 px-4 py-3 font-mono text-sm text-forest-dark">
                  {siriUrl}
                </p>
                <button onClick={handleCopySiri} className="btn-secondary mt-3">
                  {siriCopied ? "Copied!" : "Copy Siri link"}
                </button>
              </>
            )}
            <p className="mt-3 text-xs text-ink-light">
              If you reset the list link, the Siri link changes too, so update each phone&apos;s shortcut.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
