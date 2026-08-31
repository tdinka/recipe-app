"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, mode, householdName, inviteCode }),
    });
    const json = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(json.error ?? "Something went wrong.");
      return;
    }

    if (mode === "create" && json.inviteCode) {
      setCreatedCode(json.inviteCode);
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.ok) {
      router.push("/recipes");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center">
      <h1 className="font-display text-3xl italic text-brick">The Recipe Box</h1>
      <p className="mt-1 text-sm text-ink-light">Set up your family's shared recipe library.</p>

      <div className="mt-6 flex rounded-card border border-linen-400 bg-white p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-md py-1.5 ${mode === "create" ? "bg-forest text-linen-50" : "text-ink-light"}`}
        >
          Start a household
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-md py-1.5 ${mode === "join" ? "bg-forest text-linen-50" : "text-ink-light"}`}
        >
          Join with a code
        </button>
      </div>

      {createdCode ? (
        <div className="card mt-6 p-6 text-sm">
          <p className="font-semibold text-forest-dark">Household created!</p>
          <p className="mt-2 text-ink-light">
            Share this invite code with family so they can join your recipe box:
          </p>
          <p className="mt-3 rounded-md bg-forest-50 px-4 py-3 text-center font-mono text-lg tracking-widest text-forest-dark">
            {createdCode}
          </p>
          <p className="mt-3 text-xs text-ink-light">Signing you in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {mode === "create" ? (
            <div>
              <label className="label" htmlFor="householdName">Household name</label>
              <input
                id="householdName"
                required
                placeholder="e.g. The Alvarez Kitchen"
                className="input"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="inviteCode">Invite code</label>
              <input
                id="inviteCode"
                required
                placeholder="e.g. F3K9QZ"
                className="input uppercase"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-brick">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : mode === "create" ? "Create household" : "Join household"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-ink-light">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-forest hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
