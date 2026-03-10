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
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const COLLABSTR_NOTES_HEADER = "## Collabstr";

async function loadPrismaClientCtor() {
  const candidates = [
    "@prisma/client",
    pathToFileURL(
      path.join(__dirname, "../apps/web/node_modules/@prisma/client/index.js")
    ).href,
  ];

  for (const candidate of candidates) {
    try {
      const mod = await import(candidate);
      if (mod?.PrismaClient) return mod.PrismaClient;
    } catch {
      // Try next resolution candidate.
    }
  }

  throw new Error(
    "Could not load PrismaClient. Install @prisma/client or use the apps/web dependency tree."
  );
}

interface ScrapedInfluencer {
  name: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  profileDump?: string | null;
  collabstrSlug: string;
  collabstrUrl: string;
  niche: string | null;
  location: string | null;
  bio: string | null;
  imageUrl: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  website: string | null;
  followerCount: number | null;
  price: string | null;
  rating: number | null;
  reviewCount: number | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let input = path.join(__dirname, "collabstr-influencers.jsonl");
  let brandId = "9d4f824b-639a-43ce-93f9-cbf233912f91";
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

function cleanNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function resolveInstagramHandle(data: ScrapedInfluencer): string | null {
  return cleanNullableString(data.instagram) || cleanNullableString(data.instagramHandle);
}

function resolveTikTokHandle(data: ScrapedInfluencer): string | null {
  return cleanNullableString(data.tiktok) || cleanNullableString(data.tiktokHandle);
}

function buildCollabstrNotesBlock(data: ScrapedInfluencer): string {
  const lines = [
    COLLABSTR_NOTES_HEADER,
    `Profile: ${data.collabstrUrl}`,
    data.website ? `Website: ${data.website}` : null,
    data.price ? `Price: ${data.price}` : null,
    data.rating ? `Rating: ${data.rating}` : null,
    data.reviewCount ? `Review count: ${data.reviewCount}` : null,
    data.profileDump ? "" : null,
    data.profileDump ? "Profile dump:" : null,
    data.profileDump || null,
  ].filter((line): line is string => line !== null);

  return lines.join("\n").trim();
}

function buildCollabstrMetadata(data: ScrapedInfluencer) {
  return {
    collabstrSlug: data.collabstrSlug,
    collabstrUrl: data.collabstrUrl,
    niche: data.niche,
    profileDump: data.profileDump,
    location: data.location,
    website: data.website,
    instagram: resolveInstagramHandle(data),
    instagramUrl: cleanNullableString(data.instagramUrl),
    tiktok: resolveTikTokHandle(data),
    tiktokUrl: cleanNullableString(data.tiktokUrl),
    price: data.price,
    rating: data.rating,
    reviewCount: data.reviewCount,
    scrapedAt: new Date().toISOString(),
  };
}

function mergeCreatorNotes(
  existingNotes: string | null | undefined,
  data: ScrapedInfluencer
): string {
  const existing = cleanNullableString(existingNotes) || "";
  const stripped = existing
    ? existing.replace(
        new RegExp(`(?:\\n{0,2})${COLLABSTR_NOTES_HEADER}[\\s\\S]*$`),
        ""
      ).trim()
    : "";

  const collabstrBlock = buildCollabstrNotesBlock(data);
  return [stripped || null, collabstrBlock].filter(Boolean).join("\n\n");
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
    .filter((line) => line.trim());

  console.log(`Found ${lines.length} influencers to import`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const prisma = dryRun
    ? null
    : new (await loadPrismaClientCtor())();

  for (const line of lines) {
    let data: ScrapedInfluencer;
    try {
      data = JSON.parse(line);
    } catch {
      errors++;
      continue;
    }

    const instagramHandle = resolveInstagramHandle(data);
    const tiktokHandle = resolveTikTokHandle(data);

    if (!instagramHandle && !tiktokHandle && !data.name) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] ${data.name || data.collabstrSlug} | IG: ${instagramHandle || "—"} | TT: ${tiktokHandle || "—"} | dump: ${data.profileDump?.length || 0} chars`
      );
      imported++;
      continue;
    }

    try {
      const uniqueInstagramHandle = instagramHandle || data.collabstrSlug;
      const existingCreator = await prisma!.creator.findUnique({
        where: {
          brandId_instagramHandle: {
            brandId,
            instagramHandle: uniqueInstagramHandle,
          },
        },
        select: {
          id: true,
          notes: true,
        },
      });

      const mergedNotes = mergeCreatorNotes(existingCreator?.notes, data);

      const creator = await prisma!.creator.upsert({
        where: {
          brandId_instagramHandle: {
            brandId,
            instagramHandle: uniqueInstagramHandle,
          },
        },
        update: {
          name: data.name || undefined,
          bio: [data.bio, data.location].filter(Boolean).join(" | ") || undefined,
          imageUrl: data.imageUrl || undefined,
          bioCategory: data.niche || undefined,
          followerCount: data.followerCount || undefined,
          notes: mergedNotes || undefined,
        },
        create: {
          brandId,
          name: data.name,
          email: null,
          instagramHandle: uniqueInstagramHandle,
          bio: [data.bio, data.location].filter(Boolean).join(" | "),
          imageUrl: data.imageUrl,
          bioCategory: data.niche,
          followerCount: data.followerCount,
          discoverySource: "collabstr",
          notes: mergedNotes,
        },
      });

      if (tiktokHandle) {
        await prisma!.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: creator.id,
              platform: "tiktok",
            },
          },
          update: {
            handle: tiktokHandle,
            url:
              cleanNullableString(data.tiktokUrl) ||
              `https://www.tiktok.com/@${tiktokHandle}`,
          },
          create: {
            creatorId: creator.id,
            platform: "tiktok",
            handle: tiktokHandle,
            url:
              cleanNullableString(data.tiktokUrl) ||
              `https://www.tiktok.com/@${tiktokHandle}`,
          },
        });
      }

      if (instagramHandle) {
        await prisma!.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: creator.id,
              platform: "instagram",
            },
          },
          update: {
            handle: instagramHandle,
            url:
              cleanNullableString(data.instagramUrl) ||
              `https://www.instagram.com/${instagramHandle}`,
          },
          create: {
            creatorId: creator.id,
            platform: "instagram",
            handle: instagramHandle,
            url:
              cleanNullableString(data.instagramUrl) ||
              `https://www.instagram.com/${instagramHandle}`,
          },
        });
      }

      await prisma!.creatorDiscoveryTouch.create({
        data: {
          creatorId: creator.id,
          source: "collabstr",
          externalId: data.collabstrSlug,
          rawSourceCategory: data.niche,
          canonicalCategory: data.niche,
          metadata: buildCollabstrMetadata(data),
        },
      });

      imported++;
      if (imported % 50 === 0) {
        console.log(
          `[progress] ${imported} imported, ${skipped} skipped, ${errors} errors`
        );
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

  if (prisma) {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
