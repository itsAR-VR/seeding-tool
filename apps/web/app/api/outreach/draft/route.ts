import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateOutreachDraft,
  type CreatorProfile,
  type CampaignInfo,
  type DraftChannel,
} from "@/lib/ai/outreach-drafter";
import {
  getBuiltInPersona,
  isBuiltInPersonaId,
  type OutreachPersona,
} from "@/lib/ai/personas";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * POST /api/outreach/draft
 *
 * Generate AI outreach drafts for one or more campaign creators.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const body = await request.json();
    const {
      campaignCreatorIds,
      personaId = "builtin-professional",
      channel = "email" as DraftChannel,
      additionalContext,
    } = body;

    if (
      !campaignCreatorIds ||
      !Array.isArray(campaignCreatorIds) ||
      campaignCreatorIds.length === 0
    ) {
      return NextResponse.json(
        { error: "campaignCreatorIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    if (campaignCreatorIds.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 creators per batch" },
        { status: 400 }
      );
    }

    // Resolve persona
    let persona: OutreachPersona;

    if (isBuiltInPersonaId(personaId)) {
      const builtIn = getBuiltInPersona(personaId);
      if (!builtIn) {
        return NextResponse.json(
          { error: "Invalid built-in persona ID" },
          { status: 400 }
        );
      }
      persona = builtIn;
    } else {
      const dbPersona = await prisma.aiPersona.findFirst({
        where: { id: personaId, brandId: membership.brandId },
      });
      if (!dbPersona) {
        return NextResponse.json(
          { error: "Persona not found" },
          { status: 404 }
        );
      }
      persona = {
        id: dbPersona.id,
        name: dbPersona.name,
        description: dbPersona.description ?? "",
        tone: dbPersona.tone as OutreachPersona["tone"],
        systemPrompt: dbPersona.systemPrompt,
        exampleMessages: (dbPersona.exampleMessages as string[]) ?? [],
      };
    }

    // Load campaign creators with related data
    const campaignCreators = await prisma.campaignCreator.findMany({
      where: {
        id: { in: campaignCreatorIds },
        campaign: { brandId: membership.brandId },
      },
      include: {
        creator: { include: { profiles: true } },
        campaign: {
          include: {
            campaignProducts: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (campaignCreators.length === 0) {
      return NextResponse.json(
        { error: "No matching campaign creators found" },
        { status: 404 }
      );
    }

    // Load brand name
    const brand = await prisma.brand.findUnique({
      where: { id: membership.brandId },
      select: { name: true },
    });

    // Generate drafts for each creator
    const drafts = await Promise.all(
      campaignCreators.map(async (cc) => {
        const creatorProfile: CreatorProfile = {
          handle: cc.creator.instagramHandle ?? cc.creator.name ?? "creator",
          name: cc.creator.name,
          followerCount: cc.creator.followerCount,
          bio: cc.creator.bio,
          niche: cc.creator.bioCategory,
        };

        const campaignInfo: CampaignInfo = {
          name: cc.campaign.name,
          description: cc.campaign.description,
          products: cc.campaign.campaignProducts.map((cp) => ({
            name: cp.product.name,
            description: cp.product.description,
            productUrl: cp.product.productUrl,
            retailValue: cp.product.retailValue,
          })),
        };

        // A pre-written outreach draft for this creator wins over AI writing.
        const saved =
          channel === "email"
            ? await prisma.aIDraft.findFirst({
                where: { campaignCreatorId: cc.id, type: "outreach", status: "draft" },
                orderBy: { updatedAt: "desc" },
                select: { subject: true, body: true },
              })
            : null;
        if (saved) {
          return {
            campaignCreatorId: cc.id,
            creatorId: cc.creatorId,
            creatorHandle:
              cc.creator.instagramHandle ?? cc.creator.name ?? "Unknown",
            creatorName: cc.creator.name,
            subject: saved.subject,
            body: saved.body,
            tokens: 0,
            error: null,
          };
        }

        try {
          const draft = await generateOutreachDraft({
            creatorProfile,
            campaign: campaignInfo,
            persona,
            channel,
            additionalContext,
            brandName: brand?.name,
          });

          return {
            campaignCreatorId: cc.id,
            creatorId: cc.creatorId,
            creatorHandle:
              cc.creator.instagramHandle ?? cc.creator.name ?? "Unknown",
            creatorName: cc.creator.name,
            subject: draft.subject,
            body: draft.body,
            tokens: draft.tokens,
            error: null,
          };
        } catch (err) {
          console.error(
            `[outreach/draft] Failed for creator ${cc.creatorId}:`,
            err
          );
          return {
            campaignCreatorId: cc.id,
            creatorId: cc.creatorId,
            creatorHandle:
              cc.creator.instagramHandle ?? cc.creator.name ?? "Unknown",
            creatorName: cc.creator.name,
            subject: null,
            body: null,
            tokens: 0,
            error: "Failed to generate draft",
          };
        }
      })
    );

    const totalTokens = drafts.reduce((sum, d) => sum + d.tokens, 0);

    return NextResponse.json({
      drafts,
      totalTokens,
      persona: { id: persona.id, name: persona.name },
      channel,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[outreach/draft/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
