"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { sourceLabel } from "../components/creator-filters";

type ProvenancePayload = {
  creator: {
    id: string;
    name: string | null;
    instagramHandle: string | null;
    email: string | null;
    validationStatus: string;
  };
  discoveryTouches: Array<{ source: string; createdAt: string }>;
  confidenceBand: string;
  riskFlags: string[];
  scoreDecomposition: Record<string, unknown> | null;
  outcomeHistory: Array<{ id: string; reviewDecision: string | null; updatedAt: string }>;
  identity: {
    id: string;
    displayName: string | null;
    profiles: Array<{
      id: string;
      platform: string;
      handle: string;
      profileUrl: string | null;
      contactPoints: Array<{ contactType: string; contactValue: string; confidence: number }>;
    }>;
  } | null;
};

type CreatorSummary = {
  id: string;
  name: string | null;
  email: string | null;
  instagramHandle: string | null;
  followerCount: number | null;
  bio: string | null;
  optedOut: boolean;
  campaignCreators: Array<{
    id: string;
    reviewStatus: string;
    lifecycleStatus: string;
    replyDecision: string | null;
    campaign: { id: string; name: string };
    conversationThread: { id: string } | null;
  }>;
};

const REVIEW_LABELS: Record<string, string> = {
  pending: "Waiting for your review",
  approved: "Approved",
  declined: "Declined",
  deferred: "Saved for later",
};

const PROGRESS_LABELS: Record<string, string> = {
  ready: "Not emailed yet",
  outreach_sent: "Emailed",
  replied: "Replied",
  address_review: "Address to review",
  address_confirmed: "Address confirmed",
  order_created: "Order drafted",
  shipped: "Shipped",
  delivered: "Delivered",
  posted: "Posted",
  completed: "Finished",
  opted_out: "Asked not to be emailed",
  stalled: "No reply for a while",
};

const REPLY_LABELS: Record<string, string> = {
  yes: "Said yes",
  no: "Said no",
  later: "Said maybe later",
};

const CHECK_LABELS: Record<string, string> = {
  "Validation status unknown": "We couldn't confirm this account is active.",
  "Validation status retry": "We couldn't confirm this account is active yet. We'll try again.",
  "Single source only": "Only one place listed this creator.",
  "Low authenticity score": "Some of their followers may not be real.",
  "Contact point may be stale": "Their contact details may be out of date.",
};

function readable(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, " ");
}

function campaignStatus(cc: CreatorSummary["campaignCreators"][number]): string {
  if (cc.reviewStatus !== "approved") return readable(REVIEW_LABELS, cc.reviewStatus);
  const parts = [readable(PROGRESS_LABELS, cc.lifecycleStatus)];
  if (cc.replyDecision) parts.push(readable(REPLY_LABELS, cc.replyDecision));
  return parts.join(". ");
}

const backLink = (
  <Link
    href="/creators"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="size-4" aria-hidden />
    All creators
  </Link>
);

export default function CreatorProvenancePage() {
  const params = useParams<{ creatorId: string }>();
  const [payload, setPayload] = useState<ProvenancePayload | null>(null);
  const [summary, setSummary] = useState<CreatorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [summaryRes, res] = await Promise.all([
          fetch(`/api/creators/${params.creatorId}/summary`),
          fetch(`/api/creators/${params.creatorId}/provenance`),
        ]);
        if (summaryRes.ok) setSummary((await summaryRes.json()) as CreatorSummary);
        if (res.ok) setPayload((await res.json()) as ProvenancePayload);
      } catch {
        // Falls through to the "couldn't load" message below.
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.creatorId]);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <span className="sr-only" role="status">Loading creator</span>
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="rounded-xl border bg-card p-6">
          <p className="font-medium">We couldn&apos;t find this creator.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            They may have been merged with another record. Go back to your creators and search by name or handle.
          </p>
        </div>
      </div>
    );
  }

  const checks = payload?.riskFlags ?? [];
  const touches = payload?.discoveryTouches ?? [];
  const otherProfiles = payload?.identity?.profiles ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <h1 className="text-3xl font-bold tracking-tight">
          {summary.name ?? (summary.instagramHandle ? `@${summary.instagramHandle}` : "Creator")}
        </h1>
        <p className="text-muted-foreground">
          {[
            summary.instagramHandle ? `@${summary.instagramHandle}` : null,
            summary.email ?? "No email yet",
            summary.followerCount ? `${summary.followerCount.toLocaleString()} followers` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {summary.optedOut && (
          <p role="status" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            On the do-not-send list. We won&apos;t email this creator.
          </p>
        )}
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-5 py-4 font-semibold">Campaigns</h2>
        {summary.campaignCreators.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Not in a campaign yet.{" "}
            <Link href="/creators" className="text-blue-700 hover:underline">
              Add them from your creators list
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y">
            {summary.campaignCreators.map((cc) => (
              <li key={cc.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <Link href={`/campaigns/${cc.campaign.id}`} className="font-medium hover:underline">
                    {cc.campaign.name}
                  </Link>
                  <p className="text-muted-foreground">{campaignStatus(cc)}</p>
                </div>
                {cc.conversationThread ? (
                  <Link href={`/inbox/${cc.conversationThread.id}`} className="text-blue-700 hover:underline">
                    Open conversation
                  </Link>
                ) : cc.reviewStatus === "approved" && cc.lifecycleStatus === "ready" ? (
                  <Link
                    href={`/campaigns/${cc.campaign.id}/outreach?select=${cc.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    Write the first email
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.bio && (
        <section className="rounded-xl border bg-card">
          <h2 className="border-b px-5 py-4 font-semibold">Bio</h2>
          <p className="whitespace-pre-wrap px-5 py-4 text-sm">{summary.bio}</p>
        </section>
      )}

      {payload && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-4 font-semibold">Worth checking</h2>
            {checks.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nothing stands out about this creator.</p>
            ) : (
              <ul className="divide-y text-sm">
                {checks.map((flag) => (
                  <li key={flag} className="px-5 py-3">
                    {readable(CHECK_LABELS, flag)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-4 font-semibold">Where they came from</h2>
            {touches.length === 0 && otherProfiles.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No history recorded yet.</p>
            ) : (
              <div className="space-y-4 px-5 py-4 text-sm">
                {touches.length > 0 && (
                  <ul className="space-y-1">
                    {touches.map((touch, index) => (
                      <li key={`${touch.source}-${index}`}>
                        {sourceLabel(touch.source)}
                        <span className="text-muted-foreground">
                          {" "}
                          on {new Date(touch.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {otherProfiles.length > 0 && (
                  <div>
                    <p className="font-medium">Their accounts</p>
                    <ul className="mt-1 space-y-1">
                      {otherProfiles.map((profile) => (
                        <li key={profile.id}>
                          {profile.profileUrl ? (
                            <a
                              href={profile.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 hover:underline"
                            >
                              @{profile.handle}
                            </a>
                          ) : (
                            <>@{profile.handle}</>
                          )}
                          <span className="capitalize text-muted-foreground"> on {profile.platform}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
