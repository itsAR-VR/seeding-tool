"use client";

import { useEffect, useState } from "react";

type Learned = { id: string; question: string; answer: string };

/** The real replies the AI copies the voice of, with a way to drop a bad one. */
export function LearnedReplies() {
  const [replies, setReplies] = useState<Learned[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/brand-kit/learned")
      .then((r) => r.json())
      .then((d: { replies?: Learned[] }) => setReplies(d.replies ?? []))
      .catch(() => setError("Couldn't load these."));
  }, []);

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/brand-kit/learned?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't remove it. Try again.");
      return;
    }
    setReplies((list) => list?.filter((r) => r.id !== id) ?? null);
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Your replies it learns your voice from</h2>
      <p className="text-sm text-muted-foreground">
        Every reply you send to a creator teaches the suggested answers your voice. These are the latest ones it copies.
        Remove any you wouldn&apos;t want repeated.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {replies === null ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : replies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet. Reply to a creator from the Inbox and it shows up here.</p>
      ) : (
        <ul className="divide-y">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="line-clamp-2 text-muted-foreground">They asked: {r.question}</p>
                <p className="line-clamp-3 whitespace-pre-line">{r.answer}</p>
              </div>
              <button type="button" onClick={() => void remove(r.id)} className="shrink-0 text-sm font-medium underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
