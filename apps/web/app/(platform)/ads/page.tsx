import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { NoCompanyNotice } from "@/components/no-company-notice";
import { getAdResults, MetaAdsError, type AdResults } from "@/lib/meta/ads";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { Card, CardContent } from "@/components/ui/card";
import { StackedField, StackedList, StackedRow, WideOnly } from "@/components/responsive-table";
import { ChevronDown } from "lucide-react";
import { PartnershipForm } from "./partnership-form";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Running",
  PAUSED: "Paused",
  CAMPAIGN_PAUSED: "Paused",
  ADSET_PAUSED: "Paused",
  PENDING_REVIEW: "In review",
  IN_PROCESS: "Processing",
  DISAPPROVED: "Rejected",
  WITH_ISSUES: "Has issues",
};

const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: "good",
  PENDING_REVIEW: "waiting",
  IN_PROCESS: "waiting",
  DISAPPROVED: "problem",
  WITH_ISSUES: "problem",
};

const money = (n: number | null) => (n === null ? "–" : `$${n.toFixed(2)}`);

export default async function AdsPage() {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) return <NoCompanyNotice title="Ads" />;
    throw error;
  }

  const connection = await prisma.brandConnection.findFirst({
    where: { brandId, provider: "instagram" },
    select: { metadata: true, status: true },
  });
  const instagramConnected = connection?.status === "connected";
  const meta = (connection?.metadata ?? {}) as { adAccountId?: string; adsAdSetId?: string };
  const adsManagerUrl = meta.adAccountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${meta.adAccountId.replace(/^act_/, "")}${
        meta.adsAdSetId ? `&selected_adset_ids=${meta.adsAdSetId}` : ""
      }`
    : null;

  const posts = await prisma.contentPost.findMany({
    where: { brandId, metaAdId: { not: null } },
    include: { creator: { select: { id: true } } },
    orderBy: { metaAdCreatedAt: "desc" },
  });

  let results: AdResults[] = [];
  let loadError: string | null = null;
  try {
    results = await getAdResults(brandId, posts.map((p) => p.metaAdId!));
  } catch (error) {
    loadError = error instanceof MetaAdsError ? error.message : "Couldn't load results from Meta.";
  }
  const byAd = new Map(results.map((r) => [r.adId, r]));
  const totalSpend = results.reduce((sum, r) => sum + r.spend, 0);
  const totalPurchases = results.reduce((sum, r) => sum + r.purchases, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ads</h1>
        <p className="text-muted-foreground">Ads made from creator posts, with results from Meta.</p>
      </div>

      {!instagramConnected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ads run through your Instagram and Meta ad account.{" "}
          <Link href="/settings/connections" className="font-medium underline underline-offset-2">
            Connect Instagram in Settings &gt; Connections
          </Link>{" "}
          to make ads from creator posts.
        </div>
      )}

      <p className="text-lg">
        <span className="font-semibold tabular-nums">{posts.length}</span> {posts.length === 1 ? "ad" : "ads"} ·{" "}
        <span className="font-semibold tabular-nums">{money(totalSpend)}</span> spent
        {totalPurchases > 0 ? (
          <>
            {" "}· <span className="font-semibold tabular-nums">{money(totalSpend / totalPurchases)}</span> per purchase
          </>
        ) : (
          <span className="text-muted-foreground"> · no purchases yet</span>
        )}
      </p>

      <Card>
        <CardContent className="pt-6">
          {loadError && <p role="alert" className="mb-4 text-sm text-red-700">{loadError}</p>}
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ads yet. Approve usage rights on a post in <Link href="/content" className="underline">Content</Link>, then click Create ad.
            </p>
          ) : (
            <>
            <StackedList label="Ads">
              {posts.map((post) => {
                const r = byAd.get(post.metaAdId!);
                const image = post.mediaType === "VIDEO" ? post.thumbnailUrl : post.mediaUrl;
                return (
                  <StackedRow key={post.id} className="space-y-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate font-medium">@{post.username}</p>
                        <div className="flex flex-wrap gap-1">
                          <StatusPill tone={(r?.status && STATUS_TONES[r.status]) || "neutral"}>
                            {r?.status ? (STATUS_LABELS[r.status] ?? r.status) : "Not known yet"}
                          </StatusPill>
                          {post.metaAdKind === "partnership" && <StatusPill tone="neutral">Partnership</StatusPill>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <StackedField label="Spend">{money(r?.spend ?? null)}</StackedField>
                      <StackedField label="Clicks">{r?.clicks ?? "–"}</StackedField>
                      <StackedField label="Click rate">{r?.ctr != null ? `${r.ctr.toFixed(2)}%` : "–"}</StackedField>
                      <StackedField label="Cost per click">{money(r?.cpc ?? null)}</StackedField>
                      <StackedField label="Purchases">{r?.purchases ?? "–"}</StackedField>
                    </div>
                    {r && (
                      <a
                        href={r.adsManagerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-11 items-center text-sm font-medium underline"
                      >
                        Open in Ads Manager ↗
                      </a>
                    )}
                  </StackedRow>
                );
              })}
            </StackedList>
            <WideOnly className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Post</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Spend</th>
                  <th className="pb-2 font-medium">Clicks</th>
                  <th className="pb-2 font-medium">Click rate</th>
                  <th className="pb-2 font-medium">Cost per click</th>
                  <th className="pb-2 font-medium">Purchases</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const r = byAd.get(post.metaAdId!);
                  const image = post.mediaType === "VIDEO" ? post.thumbnailUrl : post.mediaUrl;
                  return (
                    <tr key={post.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={image} alt="" className="h-10 w-10 rounded object-cover" />
                          )}
                          <span>@{post.username}</span>
                          {post.metaAdKind === "partnership" && (
                            <StatusPill tone="neutral">Partnership</StatusPill>
                          )}
                        </div>
                      </td>
                      <td className="py-2">
                        <StatusPill tone={(r?.status && STATUS_TONES[r.status]) || "neutral"}>
                          {r?.status ? (STATUS_LABELS[r.status] ?? r.status) : "Not known yet"}
                        </StatusPill>
                      </td>
                      <td className="py-2">{money(r?.spend ?? null)}</td>
                      <td className="py-2">{r?.clicks ?? "–"}</td>
                      <td className="py-2">{r?.ctr != null ? `${r.ctr.toFixed(2)}%` : "–"}</td>
                      <td className="py-2">{money(r?.cpc ?? null)}</td>
                      <td className="py-2">{r?.purchases ?? "–"}</td>
                      <td className="py-2">
                        {r && (
                          <a href={r.adsManagerUrl} target="_blank" rel="noreferrer" className="whitespace-nowrap underline">
                            Ads Manager ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </WideOnly>
            </>
          )}
        </CardContent>
      </Card>

      {/* Less common, so it waits below the results until someone opens it. */}
      <details className="group rounded-xl border bg-card">
        <summary className="relative block min-h-11 cursor-pointer list-none py-4 pl-5 pr-12 [&::-webkit-details-marker]:hidden">
          <h2 className="font-semibold">Got a partnership code?</h2>
          <span className="mt-1 block text-sm text-muted-foreground">
            A creator can send you a code from Instagram that lets you run their post as an ad from their handle and
            yours.
          </span>
          <ChevronDown
            className="absolute right-5 top-5 size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <div className="border-t px-5 py-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Paste it here to make a paused ad. Works for any post.
          </p>
          <PartnershipForm adsManagerUrl={adsManagerUrl} />
        </div>
      </details>
    </div>
  );
}
