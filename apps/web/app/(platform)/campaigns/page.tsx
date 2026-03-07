import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-500",
};

export default async function CampaignsPage() {
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

  if (!membership) {
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
            Create and manage your seeding campaigns.
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>+ New Campaign</Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>
              Create your first campaign to start seeding products to creators.
            </CardDescription>
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
                    <Badge
                      className={
                        statusColors[campaign.status] ?? statusColors.draft
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    <span>
                      {campaign._count.campaignCreators} creator
                      {campaign._count.campaignCreators !== 1 ? "s" : ""}
                    </span>
                    {campaign.campaignProducts.length > 0 && (
                      <span>
                        Products:{" "}
                        {campaign.campaignProducts
                          .map((cp) => cp.product.name)
                          .join(", ")}
                      </span>
                    )}
                    <span>
                      Created{" "}
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
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
