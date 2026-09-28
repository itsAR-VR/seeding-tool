"use client";

import { useState } from "react";

type Decision = "approve" | "decline";

export function RightsForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Decision | null>(null);

  async function submit(decision: Decision) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rights/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, name }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(decision);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done === "approve") {
    return <p className="text-sm font-medium">Thank you so much! We can&apos;t wait to share it.</p>;
  }
  if (done === "decline") {
    return <p className="text-sm font-medium">Thanks for letting us know. We won&apos;t use this post.</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit("approve");
      }}
    >
      <label className="block text-sm font-medium">
        Your full name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
          className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-neutral-950 px-6 py-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving..." : "I agree"}
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit("decline")}
        className="w-full text-sm text-neutral-600 underline"
      >
        No thanks
      </button>
    </form>
  );
}
