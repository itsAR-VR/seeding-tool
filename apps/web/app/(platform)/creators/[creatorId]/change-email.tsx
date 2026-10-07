"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Give a creator a different email. After a bounce it opens by itself with the
 * reason; otherwise it waits behind a quiet "Change email" link.
 */
export function ChangeEmail({
  creatorId,
  currentEmail,
  bounced,
  onSaved,
}: {
  creatorId: string;
  currentEmail: string | null;
  bounced: boolean;
  onSaved: (message: string) => void;
}) {
  const [open, setOpen] = useState(bounced);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/creators/${creatorId}/email`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { error?: string; readyAgain?: number } | null;
    setSaving(false);
    if (!res?.ok) {
      setError(data?.error ?? "Couldn't save the email. Check your connection and try again.");
      return;
    }
    setEmail("");
    setOpen(false);
    onSaved(
      data?.readyAgain
        ? "Saved. They're back to \"Not emailed yet\", so you can send their first email to the new address."
        : "Saved.",
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium underline underline-offset-2">
        {currentEmail ? "Change email" : "Add an email"}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => void save(e)}
      className={`space-y-3 rounded-xl border p-4 ${bounced ? "border-red-200 bg-red-50" : "bg-card"}`}
    >
      {bounced && (
        <p className="text-sm text-red-900">
          <span className="font-medium">Your email to {currentEmail ?? "them"} bounced.</span> The address doesn&apos;t
          work. Add another one (from their Instagram bio, website, or link page) to try again.
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium">
          New email
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={inputId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0 flex-1 bg-background sm:max-w-sm"
          />
          <Button type="submit" disabled={saving || !email.trim()}>
            {saving ? "Saving..." : "Save email"}
          </Button>
          {!bounced && (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
