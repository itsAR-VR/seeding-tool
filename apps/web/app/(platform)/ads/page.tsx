import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { NoCompanyNotice } from "@/components/no-company-notice";
import { getAdResults, MetaAdsError, type AdResults } from "@/lib/meta/ads";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Ads</CardDescription><CardTitle>{posts.length}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total spend</CardDescription><CardTitle>{money(totalSpend)}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Cost per purchase</CardDescription><CardTitle>{totalPurchases > 0 ? money(totalSpend / totalPurchases) : "–"}</CardTitle></CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Got a partnership code from a creator?</CardTitle>
          <CardDescription>
            Paste it here to make a paused ad that runs from their handle and yours. Works for any post.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartnershipForm adsManagerUrl={adsManagerUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loadError && <p role="alert" className="mb-4 text-sm text-red-700">{loadError}</p>}
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No ads yet. Approve usage rights on a post in <Link href="/content" className="underline">Content</Link>, then click Create ad.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Post</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Spend</th>
                  <th className="pb-2 font-medium">Clicks</th>
                  <th className="pb-2 font-medium">CTR</th>
                  <th className="pb-2 font-medium">Cost/click</th>
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
                            <Badge variant="secondary">Partnership</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2">
                        <Badge variant={r?.status === "ACTIVE" ? "default" : "outline"}>
                          {r?.status ? (STATUS_LABELS[r.status] ?? r.status) : "–"}
                        </Badge>
                      </td>
                      <td className="py-2">{money(r?.spend ?? null)}</td>
                      <td className="py-2">{r?.clicks ?? "–"}</td>
                      <td className="py-2">{r?.ctr != null ? `${r.ctr.toFixed(2)}%` : "–"}</td>
                      <td className="py-2">{money(r?.cpc ?? null)}</td>
                      <td className="py-2">{r?.purchases ?? "–"}</td>
                      <td className="py-2">
                        {r && (
                          <a href={r.adsManagerUrl} target="_blank" rel="noreferrer" className="underline">
                            Ads Manager ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
