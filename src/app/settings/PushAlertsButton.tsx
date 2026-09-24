"use client";

import { useEffect, useState } from "react";

// Converts the public push key into the format browsers expect.
function keyToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

type Status = "checking" | "needs-install" | "unsupported" | "off" | "working" | "on" | "denied" | "error";

export default function PushAlertsButton() {
  const [status, setStatus] = useState<Status>("checking");
  const [note, setNote] = useState("");

  // On load: check whether this device can get alerts and whether they're already on.
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
        setStatus(isIPhone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    })().catch(() => setStatus("error"));
  }, []);

  async function turnOn() {
    setStatus("working");
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBuffer(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Couldn't save this device");
      setStatus("on");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  async function sendTest() {
    setNote("Sending…");
    const res = await fetch("/api/push/test", { method: "POST" });
    setNote(res.ok ? "Test sent! It should appear in a few seconds." : "Test failed to send.");
  }

  return (
    <div className="card p-6">
      <p className="label">Notifications</p>
      <p className="font-display text-xl text-ink">Grocery alerts</p>
      <p className="mt-1 text-sm text-ink-light">
        Get a notification on this device when new items are added to the grocery list. Items added
        in a burst are bundled into one alert.
      </p>

      {status === "checking" && <p className="mt-4 text-sm text-ink-light">Checking…</p>}

      {status === "needs-install" && (
        <p className="mt-4 text-sm text-ink-light">
          To get alerts on iPhone, open Recipe Box from its home-screen icon and come back to Settings.
        </p>
      )}

      {status === "unsupported" && (
        <p className="mt-4 text-sm text-ink-light">This browser doesn’t support notifications.</p>
      )}

      {(status === "off" || status === "error") && (
        <button onClick={turnOn} className="btn-primary mt-4">
          Turn on grocery alerts
        </button>
      )}

      {status === "working" && <p className="mt-4 text-sm text-ink-light">Turning on…</p>}

      {status === "on" && (
        <div className="mt-4 flex items-center gap-3">
          <p className="font-semibold text-forest-dark">✓ Alerts are on for this device</p>
          <button onClick={sendTest} className="btn-secondary">
            Send test
          </button>
        </div>
      )}

      {status === "denied" && (
        <p className="mt-4 text-sm text-ink-light">
          Notifications are blocked for this app. Turn them back on in your device’s notification settings.
        </p>
      )}

      {note && <p className="mt-2 text-sm text-ink-light">{note}</p>}
    </div>
  );
}
