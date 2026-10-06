import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";
import { campaignStatus } from "./_components/campaign-status";

export default async function CampaignsPage() {
  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <Card>
            <CardHeader>
              <CardTitle>No brand found</CardTitle>
              <CardDescription>
                Complete onboarding to start creating campaigns.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }
    throw error;
  }

  const campaigns = await prisma.campaign.findMany({
    where: { brandId: membership.brandId },
    include: {
      _count: { select: { campaignCreators: true } },
      campaignProducts: {
        include: { product: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Each campaign is one product sent to a list of creators.
          </p>
        </div>
        <Link href="/campaigns/new" className={buttonVariants()}>
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>
              A campaign is one product gifted to a list of creators. Start one, then pick your
              product and find creators.
            </CardDescription>
            <div className="pt-2">
              <Link href="/campaigns/new" className={buttonVariants()}>
                Start your first campaign
              </Link>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {campaign.name}
                      </CardTitle>
                      {campaign.description && (
                        <CardDescription className="mt-1">
                          {campaign.description}
                        </CardDescription>
                      )}
                    </div>
                    <StatusPill tone={campaignStatus(campaign.status).tone}>
                      {campaignStatus(campaign.status).label}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      {campaign._count.campaignCreators} creator
                      {campaign._count.campaignCreators !== 1 ? "s" : ""}
                    </span>
                    {campaign.campaignProducts.length > 0 && (
                      <span>
                        Gifting{" "}
                        {campaign.campaignProducts
                          .map((cp) => cp.product.name)
                          .join(", ")}
                      </span>
                    )}
                    <span>Started {formatDate(campaign.createdAt)}</span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
