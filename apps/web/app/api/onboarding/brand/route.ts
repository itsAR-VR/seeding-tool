import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId, requireOrg } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import {
  fetchBrandProfile,
  normalizeBrandWebsiteUrl,
} from "@/lib/brands/profile";
import {
  getBusinessDnaModel,
  mergeBrandProfileWithBusinessDna,
  synthesizeBusinessDna,
} from "@/lib/brands/synthesis";

type OnboardingAnalysisStatus = "complete" | "partial" | "failed" | "skipped";

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

    const org = await requireOrg(user.id);

    const body = await request.json();
    const { name, websiteUrl } = body as {
      name?: string;
      websiteUrl?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Brand name is required" },
        { status: 400 }
      );
    }

    let normalizedWebsiteUrl: string | null = null;
    let brandProfile = null;
    let analysisStatus: OnboardingAnalysisStatus = "skipped";
    let analysisNote: string | null = null;

    try {
      normalizedWebsiteUrl = normalizeBrandWebsiteUrl(websiteUrl);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Website URL must be a valid http(s) URL",
        },
        { status: 400 }
      );
    }

    if (normalizedWebsiteUrl) {
      analysisStatus = "failed";

      try {
        const rawProfile = await fetchBrandProfile(normalizedWebsiteUrl);
        brandProfile = mergeBrandProfileWithBusinessDna(rawProfile, {
          status: "partial",
          note: "Website signals extracted. Structured Business DNA was skipped.",
        });
        analysisStatus = "partial";

        if (process.env.OPENAI_API_KEY) {
          const businessDna = await synthesizeBusinessDna({
            brandName: name.trim(),
            websiteUrl: normalizedWebsiteUrl,
            profile: rawProfile,
          });

          if (businessDna) {
            brandProfile = mergeBrandProfileWithBusinessDna(rawProfile, {
              businessDna,
              status: "complete",
              model: getBusinessDnaModel(),
            });
            analysisStatus = "complete";
            analysisNote = null;
          } else {
            analysisNote =
              "We saved the raw website signals, but the structured Business DNA pass did not finish.";
            brandProfile = mergeBrandProfileWithBusinessDna(rawProfile, {
              status: "partial",
              model: getBusinessDnaModel(),
              note: analysisNote,
            });
          }
        } else {
          analysisNote =
            "OPENAI_API_KEY is not configured, so we saved the raw website signals without a Business DNA synthesis pass.";
          brandProfile = mergeBrandProfileWithBusinessDna(rawProfile, {
            status: "partial",
            note: analysisNote,
          });
        }
      } catch (error) {
        analysisNote =
          "We couldn't reach a usable HTML page from that URL, so the brand was created without website analysis.";
        console.warn("[onboarding/brand] brand profile extraction failed", {
          websiteUrl: normalizedWebsiteUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Find or create a default client for this org
    let client = await prisma.client.findFirst({
      where: { organizationId: org.id },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: org.name,
          organizationId: org.id,
        },
      });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existingIncompleteMembership = await prisma.brandMembership.findFirst({
      where: {
        userId: user.id,
        brand: {
          client: {
            organizationId: org.id,
          },
          onboarding: {
            isComplete: false,
          },
        },
      },
      include: {
        brand: {
          include: {
            onboarding: true,
            settings: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const staleIncompleteMemberships = await prisma.brandMembership.findMany({
      where: {
        userId: user.id,
        brand: {
          client: {
            organizationId: org.id,
          },
          onboarding: {
            isComplete: false,
          },
        },
      },
      include: {
        brand: {
          include: {
            onboarding: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Reuse the latest incomplete onboarding brand instead of creating duplicates
    // when a user retries the brand step.
    const result = await prisma.$transaction(async (tx) => {
      let brandId = existingIncompleteMembership?.brandId;

      if (brandId) {
        await tx.brand.update({
          where: { id: brandId },
          data: {
            name: name.trim(),
            slug: `${slug}-${Date.now().toString(36)}`,
            websiteUrl: normalizedWebsiteUrl,
            clientId: client.id,
          },
        });

        await tx.brandOnboarding.upsert({
          where: { brandId },
          update: {
            isComplete: false,
            currentStep: 1,
            completedSteps: JSON.stringify([1]),
          },
          create: {
            brandId,
            isComplete: false,
            currentStep: 1,
            completedSteps: JSON.stringify([1]),
          },
        });

        await tx.brandSettings.upsert({
          where: { brandId },
          update: {
            brandVoice: brandProfile?.brandVoice ?? undefined,
            brandProfile: brandProfile
              ? JSON.parse(JSON.stringify(brandProfile))
              : undefined,
          },
          create: {
            brandId,
            brandVoice: brandProfile?.brandVoice ?? undefined,
            brandProfile: brandProfile
              ? JSON.parse(JSON.stringify(brandProfile))
              : undefined,
          },
        });
      } else {
        const brand = await tx.brand.create({
          data: {
            name: name.trim(),
            slug: `${slug}-${Date.now().toString(36)}`,
            websiteUrl: normalizedWebsiteUrl,
            clientId: client.id,
          },
        });

        brandId = brand.id;

        await tx.brandOnboarding.create({
          data: {
            brandId,
            currentStep: 1,
            completedSteps: JSON.stringify([1]),
          },
        });

        await tx.brandSettings.create({
          data: {
            brandId,
            brandVoice: brandProfile?.brandVoice ?? undefined,
            brandProfile: brandProfile
              ? JSON.parse(JSON.stringify(brandProfile))
              : undefined,
          },
        });

        await tx.brandMembership.create({
          data: {
            userId: user.id,
            brandId,
            role: "owner",
          },
        });
      }

      const staleBrandIds = staleIncompleteMemberships
        .map((membership) => membership.brandId)
        .filter((candidateId) => candidateId !== brandId);

      if (staleBrandIds.length > 0) {
        await tx.brand.deleteMany({
          where: {
            id: {
              in: staleBrandIds,
            },
          },
        });
      }

      return tx.brand.findUniqueOrThrow({
        where: { id: brandId },
      });
    });

    return NextResponse.json({
      brandId: result.id,
      slug: result.slug,
      brandProfile,
      analysisStatus,
      analysisNote,
    });
  } catch (error) {
    console.error("[onboarding/brand]", error);
    return NextResponse.json(
      { error: "Failed to create brand" },
      { status: 500 }
    );
  }
}
