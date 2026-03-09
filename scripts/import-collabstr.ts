#!/usr/bin/env npx tsx
/**
 * Import scraped Collabstr influencers into the Seed Scale database.
 *
 * Reads the JSONL output from scrape-collabstr.ts and upserts into
 * the Creator + CreatorProfile tables via Prisma.
 *
 * Usage:
 *   npx tsx scripts/import-collabstr.ts [--input path] [--brand-id uuid] [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";

// Load env for DATABASE_URL
const envPath = path.join(__dirname, "../apps/web/.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ScrapedInfluencer {
  collabstrSlug: string;
  collabstrUrl: string;
  name: string | null;
  niche: string | null;
  location: string | null;
  bio: string | null;
  imageUrl: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  website: string | null;
  followerCount: number | null;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let input = path.join(__dirname, "collabstr-influencers.jsonl");
  let brandId = "9d4f824b-639a-43ce-93f9-cbf233912f91"; // Sleepkalm
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      input = args[i + 1];
      i++;
    } else if (args[i] === "--brand-id" && args[i + 1]) {
      brandId = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { input, brandId, dryRun };
}

async function main() {
  const { input, brandId, dryRun } = parseArgs();

  console.log("=== Collabstr Import ===");
  console.log(`Input: ${input}`);
  console.log(`Brand ID: ${brandId}`);
  console.log(`Dry run: ${dryRun}`);

  if (!fs.existsSync(input)) {
    console.error(`Input file not found: ${input}`);
    process.exit(1);
  }

  const lines = fs
    .readFileSync(input, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  console.log(`Found ${lines.length} influencers to import`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const line of lines) {
    let data: ScrapedInfluencer;
    try {
      data = JSON.parse(line);
    } catch {
      errors++;
      continue;
    }

    // Must have at least an IG handle or name
    if (!data.instagramHandle && !data.name) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] ${data.name} | IG: ${data.instagramHandle} | TT: ${data.tiktokHandle} | ${data.location}`
      );
      imported++;
      continue;
    }

    try {
      // Upsert creator
      const creator = await prisma.creator.upsert({
        where: {
          brandId_instagramHandle: {
            brandId,
            instagramHandle: data.instagramHandle || data.collabstrSlug,
          },
        },
        update: {
          name: data.name || undefined,
          bio: [data.bio, data.location].filter(Boolean).join(" | ") || undefined,
          imageUrl: data.imageUrl || undefined,
          bioCategory: data.niche || undefined,
          followerCount: data.followerCount || undefined,
          notes: data.collabstrUrl,
        },
        create: {
          brandId,
          name: data.name,
          email: null,
          instagramHandle: data.instagramHandle || data.collabstrSlug,
          bio: [data.bio, data.location].filter(Boolean).join(" | "),
          imageUrl: data.imageUrl,
          bioCategory: data.niche,
          followerCount: data.followerCount,
          discoverySource: "collabstr",
          notes: data.collabstrUrl,
        },
      });

      // Add TikTok profile if present
      if (data.tiktokHandle) {
        await prisma.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: creator.id,
              platform: "tiktok",
            },
          },
          update: {
            handle: data.tiktokHandle,
            url: `https://tiktok.com/@${data.tiktokHandle}`,
          },
          create: {
            creatorId: creator.id,
            platform: "tiktok",
            handle: data.tiktokHandle,
            url: `https://tiktok.com/@${data.tiktokHandle}`,
          },
        });
      }

      // Add Instagram profile record
      if (data.instagramHandle) {
        await prisma.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: creator.id,
              platform: "instagram",
            },
          },
          update: {
            handle: data.instagramHandle,
            url: `https://instagram.com/${data.instagramHandle}`,
          },
          create: {
            creatorId: creator.id,
            platform: "instagram",
            handle: data.instagramHandle,
            url: `https://instagram.com/${data.instagramHandle}`,
          },
        });
      }

      imported++;
      if (imported % 50 === 0) {
        console.log(`[progress] ${imported} imported, ${skipped} skipped, ${errors} errors`);
      }
    } catch (err) {
      console.error(
        `[error] Failed to import ${data.name || data.collabstrSlug}:`,
        err instanceof Error ? err.message : err
      );
      errors++;
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
