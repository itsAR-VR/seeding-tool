"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DiscoveryCandidate } from "@/lib/suggested-discovery/types";

function formatCount(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function monogram(candidate: DiscoveryCandidate): string {
  const source = candidate.profile.displayName ?? candidate.profile.handle;
  return source
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function statusBadge(candidate: DiscoveryCandidate) {
  switch (candidate.status) {
    case "match":
      return <Badge>Match</Badge>;
    case "rejected":
      return <Badge variant="secondary">Off niche</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

export function CandidateCard({
  runId,
  candidate,
}: {
  runId: string;
  candidate: DiscoveryCandidate;
}) {
  const { profile, verdict } = candidate;
  const screenshotUrl = profile.screenshotFile
    ? `/api/discover/suggested/${runId}/screenshots/${profile.handle}`
    : null;

  return (
    <Card className="overflow-hidden">
      {screenshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- screenshot served from run artifacts
        <img
          src={screenshotUrl}
          alt={`@${profile.handle} profile screenshot`}
          className="h-40 w-full border-b object-cover object-top"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center border-b bg-muted">
          <span className="text-3xl font-semibold text-muted-foreground">
            {monogram(candidate)}
          </span>
        </div>
      )}

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm font-semibold hover:underline"
            >
              @{profile.handle}
              {profile.isVerified && <span className="ml-1">✓</span>}
            </a>
            {profile.displayName && (
              <p className="truncate text-xs text-muted-foreground">
                {profile.displayName}
              </p>
            )}
          </div>
          {statusBadge(candidate)}
        </div>

        {profile.bio && (
          <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
            {profile.bio}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {profile.category && (
            <Badge variant="outline" className="text-[10px]">
              {profile.category}
            </Badge>
          )}
          {verdict?.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>

        {verdict && (
          <p className="text-xs text-muted-foreground">
            {verdict.reason}{" "}
            <span className="text-[10px] uppercase tracking-wide">
              · {Math.round(verdict.confidence * 100)}% · {verdict.source}
            </span>
          </p>
        )}
        {candidate.error && (
          <p className="text-xs text-destructive">{candidate.error}</p>
        )}

        <div className="flex items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
          <span>{formatCount(profile.followers)} followers</span>
          <span>{formatCount(profile.posts)} posts</span>
          {profile.externalUrl && (
            <a
              href={profile.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate hover:underline"
            >
              link ↗
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
