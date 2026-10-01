"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { token: string; email: string; signedInEmail: string | null };

/** Create a password (or sign in), then accept the invite. */
export function InviteAccept({ token, email, signedInEmail }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  async function accept() {
    const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    const data = (await res.json().catch(() => null)) as { next?: string; error?: string } | null;
    if (!res.ok || !data?.next) throw new Error(data?.error ?? "Couldn't accept the invite.");
    window.location.href = data.next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!needsSignIn) {
        const res = await fetch(`/api/invites/${token}/account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = (await res.json().catch(() => null)) as { exists?: boolean; error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? "Couldn't create your account.");
        if (data?.exists) {
          setNeedsSignIn(true);
          setError("You already have an account. Enter your existing password to join.");
          return;
        }
      }
      const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(needsSignIn ? "That password didn't work." : signInError.message);
      await accept();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (signedInEmail === email) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            accept().catch((e) => {
              setError(e instanceof Error ? e.message : "Something went wrong.");
              setBusy(false);
            });
          }}
          className="w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
        >
          {busy ? "Joining..." : "Accept invite"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      {signedInEmail && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          You&apos;re signed in as {signedInEmail}. This invite is for {email}, so you&apos;ll be switched to that account.
        </p>
      )}
      <label className="block text-sm font-medium">
        Email
        <input value={email} readOnly className="mt-1 w-full rounded-lg border bg-muted px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        {needsSignIn ? "Your password" : "Create a password"}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete={needsSignIn ? "current-password" : "new-password"}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        />
        {!needsSignIn && <span className="mt-1 block text-sm text-muted-foreground">At least 8 characters.</span>}
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
      >
        {busy ? "Joining..." : needsSignIn ? "Sign in and join" : "Create account and join"}
      </button>
    </form>
  );
}
