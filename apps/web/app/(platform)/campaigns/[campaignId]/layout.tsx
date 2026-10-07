import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";
import { StatusPill } from "@/components/status-pill";
import { campaignStatus } from "../_components/campaign-status";
import { countNeedsAnswerByCampaign } from "@/lib/stats/needs-you";
import { CampaignTabs } from "./_components/campaign-tabs";

/**
 * Every campaign page shares this header: the campaign name, its status in
 * words, and one quiet row of tabs. Sub-pages start with their own title.
 */
export default async function CampaignLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) notFound();
    throw error;
  }

  const [campaign, flags, toEmail, toAnswerByCampaign] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: campaignId, brandId },
      select: { id: true, name: true, description: true, status: true, _count: { select: { campaignCreators: true } } },
    }),
    getFeatureFlags(brandId),
    prisma.campaignCreator.count({
      where: { campaignId, campaign: { brandId }, reviewStatus: "approved", lifecycleStatus: "ready" },
    }),
    countNeedsAnswerByCampaign(brandId),
  ]);
  if (!campaign) notFound();

  const status = campaignStatus(campaign.status, {
    total: campaign._count.campaignCreators,
    toEmail,
    toAnswer: toAnswerByCampaign.get(campaign.id) ?? 0,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          {campaign.description && <p className="mt-1 text-muted-foreground">{campaign.description}</p>}
        </div>
        <CampaignTabs
          campaignId={campaign.id}
          // Same check as the seed-list API: the mix needs both features on.
          showCreatorMix={flags.portfolioOptimizerEnabled && flags.decisionEngineScoringEnabled}
        />
      </header>
      {children}
    </div>
  );
}
