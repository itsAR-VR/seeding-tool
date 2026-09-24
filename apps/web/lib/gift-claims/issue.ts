import { prisma } from "@/lib/prisma";
import { buildClaimUrl, createClaimToken, hashClaimToken } from "@/lib/gift-claims/tokens";

const CLAIM_LINK_TTL_DAYS = 14;

/** Placeholder in a reply that is swapped for the creator's private address link. */
export const ADDRESS_LINK_PLACEHOLDER = "{address link}";

export class GiftClaimIssueError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "GiftClaimIssueError";
  }
}

/**
 * Issue a private one-time gift claim link for an approved campaign creator.
 * Any earlier unused link for the same creator is revoked. The raw token is
 * returned once; only its hash is stored.
 */
export async function issueGiftClaimLink(params: {
  campaignCreatorId: string;
  createdBy: string | null;
}): Promise<{ claimUrl: string; expiresAt: Date; productName: string }> {
  const campaignCreator = await prisma.campaignCreator.findUnique({
    where: { id: params.campaignCreatorId },
    include: {
      campaign: {
        include: {
          campaignProducts: { include: { product: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!campaignCreator) {
    throw new GiftClaimIssueError("Campaign creator not found", 404);
  }

  const campaignProduct = campaignCreator.campaign.campaignProducts[0];
  if (!campaignProduct) {
    throw new GiftClaimIssueError("Add a campaign product before generating a claim link", 422);
  }

  if (campaignCreator.reviewStatus !== "approved") {
    throw new GiftClaimIssueError("Approve this creator before generating a gift claim link", 409);
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + CLAIM_LINK_TTL_DAYS);

  const token = createClaimToken();

  await prisma.$transaction([
    prisma.creatorGiftClaim.updateMany({
      where: {
        campaignCreatorId: campaignCreator.id,
        claimedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    }),
    prisma.creatorGiftClaim.create({
      data: {
        tokenHash: hashClaimToken(token),
        expiresAt,
        createdBy: params.createdBy,
        campaignCreatorId: campaignCreator.id,
        campaignProductId: campaignProduct.id,
      },
    }),
  ]);

  return { claimUrl: buildClaimUrl(token), expiresAt, productName: campaignProduct.product.name };
}
