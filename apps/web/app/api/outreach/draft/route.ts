import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateOutreachDraft,
  nicheFromNotes,
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
        { error: "Pick at least one creator to write to." },
        { status: 400 }
      );
    }

    if (campaignCreatorIds.length > 20) {
      return NextResponse.json(
        { error: "You can write to up to 20 creators at a time. Pick fewer." },
        { status: 400 }
      );
    }

    // Resolve persona
    let persona: OutreachPersona;

    if (isBuiltInPersonaId(personaId)) {
      const builtIn = getBuiltInPersona(personaId);
      if (!builtIn) {
        return NextResponse.json(
          { error: "That writing style wasn't found. Pick another one." },
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
          { error: "That writing style wasn't found. Pick another one." },
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
        { error: "We couldn't find those creators in this campaign. Refresh the page." },
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
          // CSV imports have no bio or category, only topics in their notes.
          niche: cc.creator.bioCategory ?? nicheFromNotes(cc.creator.notes),
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

        // An empty saved draft (from when the writer returned nothing) is never reused.
        if (channel === "email") {
          await prisma.aIDraft.updateMany({
            where: { campaignCreatorId: cc.id, type: "outreach", status: "draft", body: "" },
            data: { status: "discarded" },
          });
        }

        // A pre-written outreach draft for this creator wins over AI writing.
        const saved =
          channel === "email"
            ? await prisma.aIDraft.findFirst({
                where: { campaignCreatorId: cc.id, type: "outreach", status: "draft", body: { not: "" } },
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

          // Saved as soon as it's written, so it survives leaving the page and can be
          // checked today and sent tomorrow. Next time it opens as-is (see "saved" above).
          if (channel === "email" && draft.body.trim()) {
            try {
              await prisma.aIDraft.create({
                data: {
                  campaignCreatorId: cc.id,
                  type: "outreach",
                  status: "draft",
                  subject: draft.subject,
                  body: draft.body,
                },
              });
            } catch (error) {
              console.warn("[outreach/draft] couldn't save the draft", error);
            }
          }

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
            error: "Couldn't write this email. Try again, or write it yourself.",
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
      { error: "Couldn't write the emails. Try again in a minute." },
      { status: 500 }
    );
  }
}
