"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CURRENT_STAGES,
  OFF_PATH_STAGES,
  countCurrentStage,
  type CreatorStage,
  type ResultsData,
} from "@/lib/stats/campaign-counts";
import { CreatorLeaderboard } from "./creator-leaderboard";
import { DateRangeFilter } from "./date-range-filter";
import { CSVExportButton } from "./csv-export-button";

type AnalyticsDashboardProps = {
  readonly initialData: ResultsData;
  readonly campaignName: string;
};

const COST_LABELS: Record<string, string> = {
  product: "Products",
  shipping: "Shipping",
  platform_fee: "Fees",
  other: "Other",
};

/** The short note under the breakdown for people off the main path. */
const OFF_PATH_WORDS: Record<(typeof OFF_PATH_STAGES)[number], (n: number) => string> = {
  order_cancelled: (n) => `${n} ${n === 1 ? "order was" : "orders were"} cancelled`,
  said_no: (n) => `${n} said no`,
  not_now: (n) => `${n} ${n === 1 ? "isn't" : "aren't"} ready right now`,
  not_a_fit: (n) => `${n} not a fit`,
  maybe_later: (n) => `${n} maybe later`,
};

function plural(n: number, one: string, many: string): string {
  return `${new Intl.NumberFormat("en-US").format(n)} ${n === 1 ? one : many}`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** "about 6 days" from a number of hours. */
function describeHours(hours: number): string {
  if (hours < 24) return "less than a day";
  const days = Math.round(hours / 24);
  return days === 1 ? "about 1 day" : `about ${days} days`;
}

export function AnalyticsDashboard({ initialData, campaignName }: AnalyticsDashboardProps) {
  const [data, setData] = useState<ResultsData>(initialData);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleRangeChange = useCallback((newFrom: string | undefined, newTo: string | undefined) => {
    setFrom(newFrom);
    setTo(newTo);
  }, []);

  useEffect(() => {
    if (!from && !to) {
      setData(initialData);
      setLoadError(null);
      return;
    }

    let cancelled = false;

    async function fetchFiltered() {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/campaigns/${initialData.campaignId}/analytics?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setLoadError("Couldn't load results for those dates. Try again.");
          return;
        }
        const json = (await res.json()) as ResultsData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setLoadError("Couldn't load results for those dates. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFiltered();
    return () => {
      cancelled = true;
    };
  }, [from, to, initialData]);

  const count = (keys: readonly CreatorStage[]) => countCurrentStage(data.stages, keys);
  // Summary numbers are "ever reached"; the breakdown below is "where they are now".
  // Orders and posts are counted the same way as the Orders and Posts tabs (lib/stats).
  const { total, emailed, replied, ordersMade } = data.steps;
  const posts = data.postCount;
  const offPath = OFF_PATH_STAGES.map((stage) => ({ stage, n: count([stage]) })).filter(({ n }) => n > 0);
  const largest = Math.max(1, ...CURRENT_STAGES.map((stage) => count(stage.stages)));
  const typicalTimeToPost = median(data.timeToPost);
  const { likes, comments, views } = data.mentions.engagement;
  const costs = Object.entries(data.costsByType).filter(([, cents]) => cents > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DateRangeFilter onRangeChange={handleRangeChange} />
        <CSVExportButton campaignId={data.campaignId} campaignName={campaignName} />
      </div>

      {loading && <p className="text-muted-foreground">Updating results…</p>}
      {loadError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          {loadError}
        </p>
      )}

      <section aria-labelledby="so-far-heading" className="space-y-2">
        <h2 id="so-far-heading" className="text-lg font-semibold">
          So far
        </h2>
        <p className="text-lg">
          {plural(total, "creator", "creators")} · {emailed} ever emailed · {replied} ever replied ·{" "}
          {plural(ordersMade, "order", "orders")} · {plural(posts, "post", "posts")}
        </p>
      </section>

      <section aria-labelledby="stages-heading" className="space-y-3">
        <h2 id="stages-heading" className="text-lg font-semibold">
          Where everyone is now
        </h2>
        <p className="text-muted-foreground">
          Each creator is counted once, at the step they&apos;re on today, so these numbers can be
          smaller than the totals above. Someone who replied and then sent their address shows under Address in.
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          <li className="flex items-center gap-4 px-5 py-2 text-sm text-muted-foreground">
            <span className="w-44 shrink-0">Step</span>
            <span className="flex-1" />
            <span className="w-28 text-right">Now at this step</span>
          </li>
          {CURRENT_STAGES.map((stage) => {
            const n = count(stage.stages);
            const label = stage.label;
            return (
              <li key={stage.label} className="flex items-center gap-4 px-5 py-3">
                <span className="w-44 shrink-0">{label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-foreground/70"
                    style={{ width: `${(n / largest) * 100}%` }}
                  />
                </span>
                <span className="w-28 text-right font-medium tabular-nums">{n}</span>
              </li>
            );
          })}
        </ul>
        {offPath.length > 0 && (
          <p className="text-muted-foreground">
            Also: {offPath.map(({ stage, n }) => OFF_PATH_WORDS[stage](n)).join(", ")}.
          </p>
        )}
        {typicalTimeToPost != null && (
          <p className="text-muted-foreground">
            Creators usually post {describeHours(typicalTimeToPost)} after the first email.
          </p>
        )}
      </section>

      <section aria-labelledby="posts-heading" className="space-y-3">
        <h2 id="posts-heading" className="text-lg font-semibold">
          Likes and views
        </h2>
        <div className="rounded-xl border bg-card p-5">
          {data.mentions.total === 0 ? (
            <p className="text-muted-foreground">
              No likes or views to show yet. They show up once creators post and we can read the numbers.
            </p>
          ) : (
            <p>
              {plural(likes, "like", "likes")} · {plural(comments, "comment", "comments")} ·{" "}
              {plural(views, "view", "views")}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="leaders-heading" className="space-y-3">
        <h2 id="leaders-heading" className="text-lg font-semibold">
          Top creators
        </h2>
        <CreatorLeaderboard entries={data.creatorLeaderboard} />
      </section>

      <section aria-labelledby="cost-heading" className="space-y-3">
        <h2 id="cost-heading" className="text-lg font-semibold">
          What it cost
        </h2>
        {costs.length === 0 && data.summary.totalProductValueCents === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-muted-foreground">
            Nothing spent yet. Costs show up here once gift orders are made.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {data.summary.totalProductValueCents > 0 && (
              <li className="flex items-center justify-between px-5 py-3">
                <span>Product value sent</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(data.summary.totalProductValueCents)}
                </span>
              </li>
            )}
            {costs.map(([type, cents]) => (
              <li key={type} className="flex items-center justify-between px-5 py-3">
                <span>{COST_LABELS[type] ?? "Other"}</span>
                <span className="font-medium tabular-nums">{formatCurrency(cents)}</span>
              </li>
            ))}
            {costs.length > 0 && (
              <li className="flex items-center justify-between px-5 py-3 font-semibold">
                <span>Total spent</span>
                <span className="tabular-nums">{formatCurrency(data.summary.totalCostCents)}</span>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
