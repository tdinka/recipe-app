"use client";

import { useEffect, useState } from "react";

// Runs inside Safari on the post being viewed, via the Shortcuts app. Sends the
// caption to the Add a recipe page, trimmed so the address stays short enough for
// the server to accept. Instagram puts the caption in a different page tag from post
// to post (sometimes just the like count in the others), so take the longest. Page
// text can include strangers' comments, so it's only used when no tag has a caption;
// the page may still be loading then, so give it one more try first.
function shortcutScript(origin: string) {
  return `function send(retry) {
  var a = "";
  ['meta[property="og:description"]', 'meta[name="description"]', 'meta[property="og:title"]'].forEach(function (s) {
    var m = document.querySelector(s);
    if (m && m.content.length > a.length) a = m.content;
  });
  if (a.length < 200) {
    if (retry) { setTimeout(function () { send(false); }, 3000); return; }
    var b = (document.querySelector("main") || document.body).innerText || "";
    if (b.length > a.length) a = b;
  }
  var c = Array.from(a), e;
  do { e = encodeURIComponent(c.join("")); c = c.slice(0, -200); } while (e.length > 10000);
  completion("${origin}/recipes/new?sharedUrl=" + encodeURIComponent(location.href) + "&sharedText=" + e);
}
send(true);`;
}

export function RecipeShortcutSettings() {
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setScript(shortcutScript(window.location.origin));
  }, []);

  async function handleCopy() {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-6">
      <p className="label">Recipes</p>
      <p className="font-display text-xl text-ink">Save from Instagram and TikTok</p>
      <p className="mt-1 text-sm text-ink-light">
        Open a post in Safari, tap <strong>Share</strong>, then <strong>Add to Recipe Box</strong>. The recipe in the
        caption opens here for you to review before saving. Recipes that are only spoken in the video can&apos;t be
        picked up. Set this up once on each iPhone:
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink">
        <li>Open this page on the iPhone and copy the script below.</li>
        <li>
          In the iPhone&apos;s <strong>Settings</strong>, go to <strong>Apps</strong>, <strong>Shortcuts</strong>,{" "}
          <strong>Advanced</strong>, and turn on <strong>Allow Running Scripts</strong>.
        </li>
        <li>
          Open the <strong>Shortcuts</strong> app, tap <strong>+</strong>, and name the shortcut{" "}
          <strong>Add to Recipe Box</strong>.
        </li>
        <li>
          Tap the <strong>i</strong> button and turn on <strong>Show in Share Sheet</strong>. Then, in the{" "}
          <strong>Receive</strong> row at the top of the shortcut, tap the blue list of types and leave only{" "}
          <strong>Safari web pages</strong> turned on.
        </li>
        <li>
          Add the action <strong>Run JavaScript on Web Page</strong>. If <strong>Web Page</strong> looks pale, tap it
          and choose <strong>Shortcut Input</strong>. Delete the sample text and paste the script.
        </li>
        <li>
          Add the action <strong>Open URLs</strong> (it picks <strong>JavaScript Result</strong>), then tap{" "}
          <strong>Done</strong>.
        </li>
        <li>
          Sign in to Recipe Box in Safari once. Safari and the home-screen app keep separate sign-ins.
        </li>
      </ol>
      {script && (
        <>
          <pre className="mt-3 overflow-x-auto rounded-md bg-forest-50 px-4 py-3 font-mono text-xs text-forest-dark">
            {script}
          </pre>
          <button onClick={handleCopy} className="btn-secondary mt-3">
            {copied ? "Copied!" : "Copy script"}
          </button>
        </>
      )}
      <p className="mt-3 text-sm text-ink">
        <strong>This only works from Safari, not from inside the Instagram or TikTok app.</strong> In the app, copy the
        post&apos;s link, paste it into Safari&apos;s address bar, then tap Share there.
      </p>
      <p className="mt-2 text-xs text-ink-light">
        The first time you use it on a site, the iPhone asks permission to run the shortcut there.
      </p>
    </div>
  );
}
