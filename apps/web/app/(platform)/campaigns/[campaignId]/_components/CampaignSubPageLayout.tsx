import type { ReactNode } from "react";
import { BackToCampaign } from "./BackToCampaign";

/**
 * Shared layout for every campaign sub-page (orders, posts, results, and so on):
 * the same back link on top, at the same width as the main campaign page.
 */
export default async function CampaignSubPageLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  return (
    <div className="space-y-4">
      <BackToCampaign campaignId={campaignId} />
      {children}
    </div>
  );
}
