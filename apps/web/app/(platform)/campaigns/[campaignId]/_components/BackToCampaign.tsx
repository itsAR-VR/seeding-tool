import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership } from "@/lib/integrations/brand-access";

/** The small "← Campaign name" link shown at the top of every campaign sub-page. */
export async function BackToCampaign({ campaignId }: { campaignId: string }) {
  const campaign = await getCurrentBrandMembership()
    .then((m) =>
      prisma.campaign.findFirst({
        where: { id: campaignId, brandId: m.brandId },
        select: { name: true },
      })
    )
    .catch(() => null);

  return (
    <Link
      href={`/campaigns/${campaignId}`}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      <span aria-hidden>←</span>
      {campaign?.name ?? "Back to campaign"}
    </Link>
  );
}
