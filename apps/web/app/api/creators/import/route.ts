import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/creators/import — Bulk import creators from CSV data.
 *
 * Body: { rows: Array<{ username, email?, followerCount?, avgViews?, bioCategory?, discoverySource? }> }
 *
 * // INVARIANT: Creators are deduplicated by instagramHandle on import
 * // INVARIANT: discoverySource is always tagged — never null
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

    const body = (await request.json()) as {
      rows: Array<{
        username: string;
        email?: string;
        followerCount?: number;
        avgViews?: number;
        bioCategory?: string;
        discoverySource?: string;
      }>;
    };

    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 }
      );
    }

    // Validate rows
    const validSources = [
      "phantombuster",
      "apify",
      "csv_import",
      "manual",
      "creator_marketplace",
    ];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of body.rows) {
      const handle = row.username?.trim()?.replace(/^@/, "");
      if (!handle) {
        skipped++;
        continue;
      }

      const source = validSources.includes(row.discoverySource ?? "")
        ? row.discoverySource!
        : "csv_import";

      // INVARIANT: Creators are deduplicated by instagramHandle on import
      const existing = await prisma.creator.findFirst({
        where: {
          brandId: membership.brandId,
          instagramHandle: handle,
        },
      });

      if (existing) {
        // Update with new data if provided
        await prisma.creator.update({
          where: { id: existing.id },
          data: {
            email: row.email || existing.email,
            followerCount: row.followerCount ?? existing.followerCount,
            avgViews: row.avgViews ?? existing.avgViews,
            bioCategory: row.bioCategory || existing.bioCategory,
            // Don't overwrite discoverySource if already set to something more specific
          },
        });
        updated++;
      } else {
        // INVARIANT: discoverySource is always tagged — never null
        await prisma.creator.create({
          data: {
            instagramHandle: handle,
            name: handle,
            email: row.email || null,
            followerCount: row.followerCount ?? null,
            avgViews: row.avgViews ?? null,
            bioCategory: row.bioCategory || null,
            discoverySource: source,
            brandId: membership.brandId,
          },
        });

        // Also create CreatorProfile for instagram
        const creator = await prisma.creator.findFirst({
          where: {
            brandId: membership.brandId,
            instagramHandle: handle,
          },
        });

        if (creator) {
          await prisma.creatorProfile.upsert({
            where: {
              creatorId_platform: {
                creatorId: creator.id,
                platform: "instagram",
              },
            },
            update: {
              handle,
              followerCount: row.followerCount ?? null,
            },
            create: {
              creatorId: creator.id,
              platform: "instagram",
              handle,
              followerCount: row.followerCount ?? null,
              url: `https://instagram.com/${handle}`,
            },
          });
        }

        created++;
      }
    }

    return NextResponse.json({ created, updated, skipped });
  } catch (error) {
    console.error("[creators/import/POST]", error);
    return NextResponse.json(
      { error: "Failed to import creators" },
      { status: 500 }
    );
  }
}
