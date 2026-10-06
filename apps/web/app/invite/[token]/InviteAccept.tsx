"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
  email: string;
  signedInEmail: string | null;
  /** "signin" when the invite was already accepted and they're signing back in. */
  mode?: "join" | "signin";
};

const NETWORK_ERROR = "We couldn't send that. Check your connection and tap the button again.";

/**
 * Joining needs proof the person owns the invited email: they get a sign-in
 * link at that address, which brings them back here signed in. Then they can
 * set a password (optional) and accept.
 */
export function InviteAccept({ token, email, signedInEmail, mode = "join" }: Props) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${token}/link`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "We couldn't send the email. Tap the button again.");
        return;
      }
      setSent(true);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
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
      let res: Response;
      try {
        res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      } catch {
        throw new Error(NETWORK_ERROR);
      }
      const data = (await res.json().catch(() => null)) as { next?: string; error?: string } | null;
      if (!res.ok || !data?.next) throw new Error(data?.error ?? "We couldn't accept the invite. Tap Accept invite again.");
      window.location.href = data.next;
    } catch (e) {
      setError(e instanceof Error ? e.message : NETWORK_ERROR);
      setBusy(false);
    }
  }

  if (mode === "join" && signedInEmail === email) {
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
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
          />
          <span className="mt-1 block text-sm text-neutral-700">
            At least 8 characters. Skip it and you can always sign in with an email link.
          </span>
        </label>
        <div role="alert" aria-live="assertive">{error && <p className="text-sm text-red-700">{error}</p>}</div>
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-11 rounded-full bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
        >
          {busy ? "Joining..." : "Accept invite"}
        </button>
      </form>
    );
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-[#f8f3ec] p-4">
          Check <strong>{email}</strong> for an email from us. {mode === "signin" ? "Open the link in it to sign in." : "Open the link in it to finish joining."}
        </p>
        <button type="button" disabled={busy} onClick={() => void sendLink()} className="min-h-11 text-sm font-medium underline">
          Send it again
        </button>
        <div role="alert" aria-live="assertive">{error && <p className="text-sm text-red-700">{error}</p>}</div>
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
      <div role="alert" aria-live="assertive">{error && <p className="text-sm text-red-700">{error}</p>}</div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void sendLink()}
        className="w-full min-h-11 rounded-full bg-foreground px-4 py-3 font-medium text-background disabled:opacity-50"
      >
        {busy ? "Sending..." : mode === "signin" ? "Email me a sign-in link" : "Email me a link to join"}
      </button>
    </div>
  );
}
