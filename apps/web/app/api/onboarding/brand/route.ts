import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/tenancy";
import { findOpenCompanyInvite, isPlatformAdmin } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { getOrAcceptInvitedUser } from "@/lib/invite-user";
import {
  fetchBrandProfile,
  normalizeBrandWebsiteUrl,
} from "@/lib/brands/profile";
import {
  getBusinessDnaModel,
  mergeBrandProfileWithBusinessDna,
  synthesizeBusinessDna,
} from "@/lib/brands/synthesis";
import { brandSlug } from "@/lib/onboarding/brand-slug";
import { findBrandInSetup, setActiveBrandCookie } from "@/lib/onboarding/setup-state";

// Reading the site (8s cap) plus the Business DNA pass (35s cap) stays well
// under this, so a slow or huge website can never time the whole step out.
export const maxDuration = 60;

const MAX_NAME_LENGTH = 80;

class InviteAlreadyUsedError extends Error {}

type OnboardingAnalysisStatus = "complete" | "partial" | "failed" | "skipped";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Your session ended. Sign in again to keep going." }, { status: 401 });
    }

    const user = await getOrAcceptInvitedUser(authUser);
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find an invite for this account. Open the invite link you were emailed." },
        { status: 404 }
      );
    }

    const org = await requireOrg(user.id);

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      websiteUrl?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl : undefined;

    if (!name) {
      return NextResponse.json({ error: "Enter your brand name." }, { status: 400 });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Keep the brand name under ${MAX_NAME_LENGTH} characters.` },
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
              : "Enter a website like yourbrand.com, or leave it empty.",
        },
        { status: 400 }
      );
    }

    // Retrying the brand step (Back, refresh, double submit) reuses the company
    // already being set up instead of creating another one.
    const brandInSetup = await findBrandInSetup(user.id);

    const staleIncompleteMemberships = await prisma.brandMembership.findMany({
      where: {
        userId: user.id,
        role: "owner",
        brand: {
          client: {
            organizationId: org.id,
          },
          onboarding: {
            isComplete: false,
          },
        },
      },
      select: { brandId: true },
    });

    // Invite-only, checked before the slow website read: a brand-new company
    // needs an accepted company invite (or a platform admin). Retrying an
    // unfinished setup is always allowed.
    const companyInvite = brandInSetup ? null : await findOpenCompanyInvite(user.email);
    if (!brandInSetup && !companyInvite && !isPlatformAdmin(user.email)) {
      return NextResponse.json(
        { error: "Seed Scale is invite-only. Use the invite link you were sent." },
        { status: 403 }
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
            brandName: name,
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

    // Reuse the latest incomplete onboarding brand instead of creating duplicates
    // when a user retries the brand step.
    const result = await prisma.$transaction(async (tx) => {
      let brandId = brandInSetup?.id;

      if (brandId) {
        await tx.brand.update({
          where: { id: brandId },
          data: {
            name,
            // Keep the slug stable unless the brand was renamed.
            ...(brandInSetup?.name === name ? {} : { slug: brandSlug(name) }),
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
            name,
            slug: brandSlug(name),
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

        // Mark the invite as used by linking it to the company it created.
        if (companyInvite) {
          const linked = await tx.brandInvite.updateMany({
            where: { id: companyInvite.id, brandId: null },
            data: { brandId },
          });
          if (linked.count === 0) throw new InviteAlreadyUsedError();
        }
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

    // Brand kit, connections and Home all follow the active-brand cookie, so
    // point it at the company being set up (matters for people with two).
    await setActiveBrandCookie(result.id);

    return NextResponse.json({
      brandId: result.id,
      slug: result.slug,
      brandProfile,
      analysisStatus,
      analysisNote,
    });
  } catch (error) {
    if (error instanceof InviteAlreadyUsedError) {
      // A second click raced the first one; the first one created the brand.
      return NextResponse.json(
        { error: "Your brand is already being saved. Refresh the page to keep going." },
        { status: 409 }
      );
    }
    console.error("[onboarding/brand]", error);
    return NextResponse.json(
      { error: "Couldn't save your brand. Try again in a minute." },
      { status: 500 }
    );
  }
}
