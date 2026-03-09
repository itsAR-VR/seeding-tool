import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TriggerSearchButton } from "./_components/TriggerSearchButton";

const lifecycleColors: Record<string, string> = {
  ready: "bg-gray-100 text-gray-800",
  outreach_sent: "bg-blue-100 text-blue-800",
  replied: "bg-purple-100 text-purple-800",
  address_confirmed: "bg-green-100 text-green-800",
  order_created: "bg-teal-100 text-teal-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  posted: "bg-pink-100 text-pink-800",
  completed: "bg-green-200 text-green-900",
  opted_out: "bg-red-100 text-red-800",
  stalled: "bg-yellow-100 text-yellow-800",
};

const reviewColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  deferred: "bg-gray-100 text-gray-600",
};

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignDetailPage({ params }: PageProps) {
  const { campaignId } = await params;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) return null;

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) return notFound();

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, brandId: membership.brandId },
    include: {
      campaignProducts: {
        include: { product: true },
      },
      campaignCreators: {
        include: {
          creator: { include: { profiles: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) return notFound();

  const creators = campaign.campaignCreators;
  const stats = {
    total: creators.length,
    pendingReview: creators.filter((c) => c.reviewStatus === "pending").length,
    approved: creators.filter((c) => c.reviewStatus === "approved").length,
    declined: creators.filter((c) => c.reviewStatus === "declined").length,
    outreachSent: creators.filter(
      (c) => c.lifecycleStatus !== "ready" && c.reviewStatus === "approved"
    ).length,
    replied: creators.filter((c) => c.lifecycleStatus === "replied").length,
    addressConfirmed: creators.filter(
      (c) => c.lifecycleStatus === "address_confirmed"
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {campaign.name}
            </h1>
            <Badge
              className={
                campaign.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }
            >
              {campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="mt-1 text-muted-foreground">
              {campaign.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/campaigns/${campaignId}/analytics`}>
            <Button variant="outline">📊 Analytics</Button>
          </Link>
          <TriggerSearchButton campaignId={campaignId} />
          <Link href={`/campaigns/${campaignId}/outreach`}>
            <Button variant="outline">✨ Draft Outreach</Button>
          </Link>
          <Link href={`/campaigns/${campaignId}/review`}>
            <Button variant="outline">
              Review Queue ({stats.pendingReview})
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pendingReview },
          { label: "Approved", value: stats.approved },
          { label: "Declined", value: stats.declined },
          { label: "Outreach Sent", value: stats.outreachSent },
          { label: "Replied", value: stats.replied },
          { label: "Address", value: stats.addressConfirmed },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Products</CardTitle>
          <Link href={`/campaigns/${campaignId}/products`}>
            <Button variant="outline" size="sm">
              {campaign.campaignProducts.length > 0
                ? "Manage Products"
                : "Add Products"}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {campaign.campaignProducts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {campaign.campaignProducts.map((cp) => (
                <Badge key={cp.id} variant="outline">
                  {cp.product.name}
                  {cp.product.retailValue
                    ? ` ($${(cp.product.retailValue / 100).toFixed(2)})`
                    : ""}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No products added yet. Add products from your Shopify catalog.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Creator List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creators</CardTitle>
          <CardDescription>
            {creators.length} creator{creators.length !== 1 ? "s" : ""} in this
            campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          {creators.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No creators added yet.
              </p>
              <div className="flex gap-2">
                <Link href={`/campaigns/${campaignId}/discover`}>
                  <Button size="sm">🔍 Discover Creators</Button>
                </Link>
                <Link href={`/campaigns/${campaignId}/import`}>
                  <Button size="sm" variant="outline">Import Manually</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Creator</th>
                    <th className="pb-2 font-medium">Handle</th>
                    <th className="pb-2 font-medium">Followers</th>
                    <th className="pb-2 font-medium">Review</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((cc) => {
                    const profile = cc.creator.profiles[0];
                    return (
                      <tr key={cc.id} className="border-b last:border-0">
                        <td className="py-2">
                          {cc.creator.name ?? "Unknown"}
                        </td>
                        <td className="py-2">
                          {profile ? (
                            profile.url ? (
                              <a
                                href={profile.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                @{profile.handle}
                              </a>
                            ) : (
                              `@${profile.handle}`
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2">
                          {profile?.followerCount?.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-2">
                          <Badge
                            className={
                              reviewColors[cc.reviewStatus] ??
                              reviewColors.pending
                            }
                          >
                            {cc.reviewStatus}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Badge
                            className={
                              lifecycleColors[cc.lifecycleStatus] ??
                              lifecycleColors.ready
                            }
                          >
                            {cc.lifecycleStatus.replace(/_/g, " ")}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
