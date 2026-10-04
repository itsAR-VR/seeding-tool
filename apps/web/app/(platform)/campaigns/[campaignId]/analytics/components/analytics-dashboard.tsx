"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnalyticsResponse } from "@/lib/analytics/types";
import { CreatorLeaderboard } from "./creator-leaderboard";
import { DateRangeFilter } from "./date-range-filter";
import { CSVExportButton } from "./csv-export-button";

type AnalyticsDashboardProps = {
  readonly initialData: AnalyticsResponse;
  readonly campaignName: string;
  /** Tagged + hand-added posts for the whole campaign (the date filter falls back to logged posts). */
  readonly postCount: number;
};

/** Plain stages, in order. Each groups one or more stored lifecycle statuses. */
const STAGES: readonly { label: string; keys: readonly string[] }[] = [
  { label: "Not emailed yet", keys: ["ready"] },
  { label: "Emailed", keys: ["outreach_sent"] },
  { label: "Replied", keys: ["replied"] },
  { label: "Address in", keys: ["address_review", "address_confirmed"] },
  { label: "Order created", keys: ["order_created"] },
  { label: "Shipped", keys: ["shipped"] },
  { label: "Delivered", keys: ["delivered"] },
  { label: "Posted", keys: ["posted"] },
  { label: "Done", keys: ["completed"] },
];

/** Everyone at "Replied" or any later stage has replied at some point. */
const REPLIED_OR_LATER = STAGES.slice(2).flatMap((stage) => stage.keys);

const COST_LABELS: Record<string, string> = {
  product: "Products",
  shipping: "Shipping",
  platform_fee: "Fees",
  other: "Other",
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

export function AnalyticsDashboard({ initialData, campaignName, postCount }: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsResponse>(initialData);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const filtered = Boolean(from || to);

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
        const json = (await res.json()) as AnalyticsResponse;
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

  const count = (keys: readonly string[]) => keys.reduce((sum, key) => sum + (data.lifecycle[key] ?? 0), 0);
  const total = data.summary.totalCreators;
  const replied = count(REPLIED_OR_LATER);
  const posts = filtered ? data.summary.totalMentions : postCount;
  const saidNo = count(["opted_out"]);
  const notNow = count(["stalled"]);
  const largest = Math.max(1, ...STAGES.map((stage) => count(stage.keys)));
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

      <p className="text-lg">
        {plural(total, "creator", "creators")} · {replied} replied · {plural(data.summary.totalOrders, "order", "orders")}{" "}
        · {plural(posts, "post", "posts")}
      </p>

      <section aria-labelledby="stages-heading" className="space-y-3">
        <h2 id="stages-heading" className="text-lg font-semibold">
          Where everyone is
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {STAGES.map((stage) => {
            const n = count(stage.keys);
            return (
              <li key={stage.label} className="flex items-center gap-4 px-5 py-3">
                <span className="w-36 shrink-0">{stage.label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-foreground/70"
                    style={{ width: `${(n / largest) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right font-medium tabular-nums">{n}</span>
              </li>
            );
          })}
        </ul>
        {(saidNo > 0 || notNow > 0) && (
          <p className="text-muted-foreground">
            {[
              saidNo > 0 ? `${saidNo} said no` : null,
              notNow > 0 ? `${notNow} ${notNow === 1 ? "isn't" : "aren't"} ready right now` : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .
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
