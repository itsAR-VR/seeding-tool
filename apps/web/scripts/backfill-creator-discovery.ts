#!/usr/bin/env npx tsx

import { classifyDiscoveryText } from "@/lib/creator-search/classification";
import { prisma } from "@/lib/prisma";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  const brandId = readFlag("--brand-id");
  const dryRun = process.argv.includes("--dry-run");

  const creators = await prisma.creator.findMany({
    where: brandId ? { brandId } : undefined,
    include: {
      discoveryTouches: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let createdTouches = 0;
  let updatedTouches = 0;
  let updatedCategories = 0;
  let skipped = 0;

  for (const creator of creators) {
    const primarySource = creator.discoverySource || "manual";
    const classification = classifyDiscoveryText({
      rawSourceCategory: creator.bioCategory,
      bio: creator.bio,
      name: creator.name,
      profileDump: null,
    });

    const existingTouch = creator.discoveryTouches.find(
      (touch) => touch.source === primarySource
    );

    if (!existingTouch && !creator.bioCategory && !creator.bio) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      if (!existingTouch) {
        createdTouches += 1;
      } else if (
        !existingTouch.canonicalCategory ||
        !existingTouch.rawSourceCategory
      ) {
        updatedTouches += 1;
      }

      if (creator.bioCategory !== classification.canonicalCategory) {
        updatedCategories += 1;
      }
      continue;
    }

    if (!existingTouch) {
      await prisma.creatorDiscoveryTouch.create({
        data: {
          creatorId: creator.id,
          source: primarySource,
          externalId: creator.instagramHandle ?? creator.id,
          rawSourceCategory: creator.bioCategory,
          canonicalCategory: classification.canonicalCategory,
          email: creator.email,
          metadata: {
            backfilled: true,
            classificationConfidence: classification.confidence,
            matchedKeywords: classification.matchedKeywords,
          },
        },
      });
      createdTouches += 1;
    } else if (
      !existingTouch.canonicalCategory ||
      !existingTouch.rawSourceCategory
    ) {
      await prisma.creatorDiscoveryTouch.update({
        where: { id: existingTouch.id },
        data: {
          rawSourceCategory:
            existingTouch.rawSourceCategory ?? creator.bioCategory,
          canonicalCategory:
            existingTouch.canonicalCategory ?? classification.canonicalCategory,
          metadata: {
            ...(existingTouch.metadata &&
            typeof existingTouch.metadata === "object" &&
            !Array.isArray(existingTouch.metadata)
              ? existingTouch.metadata
              : {}),
            backfilled: true,
            classificationConfidence: classification.confidence,
            matchedKeywords: classification.matchedKeywords,
          },
        },
      });
      updatedTouches += 1;
    }

    if (creator.bioCategory !== classification.canonicalCategory) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: {
          bioCategory: classification.canonicalCategory,
        },
      });
      updatedCategories += 1;
    }
  }

  console.log(
    `[creator-backfill] complete: ${createdTouches} touches created, ${updatedTouches} touches updated, ${updatedCategories} creator categories updated, ${skipped} skipped`
  );
}

main()
  .catch((error) => {
    console.error("[creator-backfill] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
