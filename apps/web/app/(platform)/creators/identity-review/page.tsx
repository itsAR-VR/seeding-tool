"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileSide = {
  platform: string;
  handle: string;
  profileUrl: string | null;
  creators: Array<{ id: string; name: string | null; instagramHandle: string | null }>;
};

type EdgeRecord = {
  id: string;
  matchScore: number;
  matchBand: string;
  fromProfile: ProfileSide;
  toProfile: ProfileSide;
};

type ReviewAction = "confirm" | "reject" | "defer";

const MATCH_LABELS: Record<string, string> = {
  auto_linked: "Very likely the same person",
  possible_match: "Possibly the same person",
};

const DONE_TEXT: Record<ReviewAction, string> = {
  confirm: "Merged. We now treat them as one person.",
  reject: "Kept as two separate creators.",
  defer: "Skipped. It won't show here again.",
};

function ProfileCard({ side }: { side: ProfileSide }) {
  const creator = side.creators[0];
  const name = creator?.name && creator.name !== side.handle ? creator.name : null;
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-sm">
      {name ? <p className="font-medium">{name}</p> : null}
      {side.profileUrl ? (
        <a
          href={side.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline"
        >
          @{side.handle}
        </a>
      ) : (
        <p>@{side.handle}</p>
      )}
      <p className="capitalize text-muted-foreground">On {side.platform}</p>
      {creator ? (
        <Link href={`/creators/${creator.id}`} className="mt-1 inline-block text-muted-foreground underline hover:text-foreground">
          Open creator
        </Link>
      ) : null}
    </div>
  );
}

export default function IdentityReviewPage() {
  const [edges, setEdges] = useState<EdgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmingMerge, setConfirmingMerge] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function fetchEdges() {
    setLoadError(null);
    try {
      const res = await fetch("/api/identity/review");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEdges(data.edges ?? []);
      } else if (res.status === 403) {
        setLoadError(
          "Duplicate review isn't available for your account. Only admins can merge creators, and it has to be turned on for your brand."
        );
      } else {
        setLoadError("We couldn't load possible duplicates. Refresh the page to try again.");
      }
    } catch {
      setLoadError("We couldn't load possible duplicates. Check your connection and refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchEdges();
  }, []);

  async function resolve(edgeId: string, action: ReviewAction) {
    setUpdating(edgeId);
    setNotice(null);
    try {
      const res = await fetch(`/api/identity/review/${edgeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setEdges((current) => current.filter((edge) => edge.id !== edgeId));
        setNotice({ ok: true, text: DONE_TEXT[action] });
      } else {
        const data = await res.json().catch(() => ({}));
        setNotice({
          ok: false,
          text:
            res.status === 403 && typeof data.error === "string" && data.error.includes("another brand")
              ? "This creator is shared with another brand, so it can't be merged here."
              : "That didn't save. Try again.",
        });
      }
    } catch {
      setNotice({ ok: false, text: "That didn't save. Check your connection and try again." });
    } finally {
      setUpdating(null);
      setConfirmingMerge(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/creators"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All creators
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Review duplicates</h1>
        <p className="text-muted-foreground">
          These look like the same person saved twice. Merge the ones that match so their accounts stay together.
        </p>
      </div>

      {notice && (
        <p role="status" className={`text-sm ${notice.ok ? "text-green-800" : "text-destructive"}`}>
          {notice.text}
        </p>
      )}

      <section className="rounded-xl border bg-card" aria-busy={loading}>
        <h2 className="border-b px-5 py-4 font-semibold">
          {loading
            ? "Possible duplicates"
            : `${edges.length} possible ${edges.length === 1 ? "duplicate" : "duplicates"}`}
        </h2>

        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : loadError ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{loadError}</p>
        ) : edges.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-medium">No duplicates to review</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We check for these when you find or import creators. Nothing needs you here.
            </p>
            <Link href="/creators" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
              Back to your creators
            </Link>
          </div>
        ) : (
          <ul className="divide-y">
            {edges.map((edge) => {
              const busy = updating === edge.id;
              const askingMerge = confirmingMerge === edge.id;
              return (
                <li key={edge.id} className="space-y-3 px-5 py-4">
                  <p className="text-sm font-medium">
                    {MATCH_LABELS[edge.matchBand] ?? "Possibly the same person"}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ({Math.round(edge.matchScore * 100)}% alike)
                    </span>
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ProfileCard side={edge.fromProfile} />
                    <ProfileCard side={edge.toProfile} />
                  </div>

                  {askingMerge ? (
                    <div
                      role="alertdialog"
                      aria-label="Confirm merge"
                      className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm"
                    >
                      <p className="flex-1">
                        Merge these? From now on we treat both accounts as one person. You can&apos;t undo this here.
                      </p>
                      <div className="flex gap-2">
                        <Button disabled={busy} onClick={() => resolve(edge.id, "confirm")}>
                          {busy ? "Merging..." : "Yes, merge"}
                        </Button>
                        <Button variant="outline" disabled={busy} onClick={() => setConfirmingMerge(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={busy} onClick={() => setConfirmingMerge(edge.id)}>
                        Merge, same person
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => resolve(edge.id, "reject")}>
                        Keep separate
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => resolve(edge.id, "defer")}>
                        Not sure, skip
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
