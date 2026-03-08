import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
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

/**
 * POST /api/outreach/draft
 *
 * Generate AI outreach drafts for one or more campaign creators.
 *
 * Body: {
 *   campaignCreatorIds: string[];
 *   personaId?: string;        // built-in ID or custom AiPersona UUID
 *   channel?: "email" | "instagram_dm";
 *   additionalContext?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySupabaseId(authUser.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

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
      // Custom persona from DB
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
    console.error("[outreach/draft/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
