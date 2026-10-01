"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { token: string; email: string; signedInEmail: string | null };

/**
 * Joining needs proof the person owns the invited email: they get a sign-in
 * link at that address, which brings them back here signed in. Then they can
 * set a password (optional) and accept.
 */
export function InviteAccept({ token, email, signedInEmail }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invites/${token}/link`, { method: "POST" });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Couldn't send the email. Try again.");
      return;
    }
    setSent(true);
  }

  async function accept(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (password) {
        const { error: pwError } = await createClient().auth.updateUser({ password });
        if (pwError) throw new Error("Couldn't save that password. Try a different one, or leave it blank.");
      }
      const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { next?: string; error?: string } | null;
      if (!res.ok || !data?.next) throw new Error(data?.error ?? "Couldn't accept the invite.");
      window.location.href = data.next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (signedInEmail === email) {
    return (
      <form onSubmit={(e) => void accept(e)} className="space-y-4">
        <label className="block text-sm font-medium">
          Set a password (optional)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
          <span className="mt-1 block text-sm text-muted-foreground">
            At least 8 characters. Skip it and you can always sign in with an email link.
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
        >
          {busy ? "Joining..." : "Accept invite"}
        </button>
      </form>
    );
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-muted p-4">
          Check <strong>{email}</strong> for an email from us. Open the link in it to finish joining.
        </p>
        <button type="button" disabled={busy} onClick={() => void sendLink()} className="text-sm font-medium underline">
          Send it again
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {signedInEmail && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          You&apos;re signed in as {signedInEmail}. This invite is for {email}, so you&apos;ll be switched to that account.
        </p>
      )}
      <p>
        We&apos;ll email a link to <strong>{email}</strong> to confirm it&apos;s you.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void sendLink()}
        className="w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
      >
        {busy ? "Sending..." : "Email me a link to join"}
      </button>
    </div>
  );
}
