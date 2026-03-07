#!/usr/bin/env tsx
/**
 * Airtable → Seed Scale Migration Script
 *
 * Maps Airtable records (Kalm's Instagram Influencers table) to Creator + CampaignCreator rows.
 *
 * Usage:
 *   npx tsx apps/web/scripts/migrate-airtable.ts \
 *     --input ./airtable-export.json \
 *     --org-id <orgId> \
 *     --campaign-id <campaignId> \
 *     [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

// ─── Status Mapping ──────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  Pending: "ready",
  Contacted: "outreach_sent",
  "Address Received": "address_received",
  "Order Placed": "order_placed",
  Shipped: "shipped",
  Delivered: "delivered",
  Posted: "mentioned",
  Closed: "closed",
  Rejected: "closed",
};

// ─── Types ───────────────────────────────────────────────

interface AirtableRecord {
  // Common Airtable field names — adjusted per actual export
  Name?: string;
  name?: string;
  Email?: string;
  email?: string;
  "Instagram Handle"?: string;
  instagram_handle?: string;
  instagramHandle?: string;
  Username?: string;
  username?: string;
  Status?: string;
  status?: string;
  "Follower Count"?: number;
  followerCount?: number;
  follower_count?: number;
  Notes?: string;
  notes?: string;
  Bio?: string;
  bio?: string;
  [key: string]: unknown;
}

interface MigrationResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ record: string; error: string }>;
}

// ─── Helpers ─────────────────────────────────────────────

function extractHandle(record: AirtableRecord): string | null {
  const raw =
    record["Instagram Handle"] ||
    record.instagram_handle ||
    record.instagramHandle ||
    record.Username ||
    record.username ||
    null;

  if (!raw) return null;

  // Normalize: remove @ prefix, trim whitespace
  return String(raw).replace(/^@/, "").trim().toLowerCase() || null;
}

function extractName(record: AirtableRecord): string | null {
  return (record.Name || record.name || null) as string | null;
}

function extractEmail(record: AirtableRecord): string | null {
  return (record.Email || record.email || null) as string | null;
}

function extractStatus(record: AirtableRecord): string {
  const raw = (record.Status || record.status || "Pending") as string;
  return STATUS_MAP[raw] || "ready";
}

function extractFollowerCount(record: AirtableRecord): number | null {
  const raw =
    record["Follower Count"] || record.followerCount || record.follower_count;
  if (raw === undefined || raw === null) return null;
  const num = Number(raw);
  return isNaN(num) ? null : num;
}

function extractNotes(record: AirtableRecord): string | null {
  return (record.Notes || record.notes || null) as string | null;
}

function extractBio(record: AirtableRecord): string | null {
  return (record.Bio || record.bio || null) as string | null;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const inputIdx = args.indexOf("--input");
  const orgIdx = args.indexOf("--org-id");
  const campaignIdx = args.indexOf("--campaign-id");
  const dryRun = args.includes("--dry-run");

  if (inputIdx === -1 || orgIdx === -1 || campaignIdx === -1) {
    console.error(
      "Usage: npx tsx apps/web/scripts/migrate-airtable.ts --input <file> --org-id <id> --campaign-id <id> [--dry-run]"
    );
    process.exit(1);
  }

  const inputPath = args[inputIdx + 1];
  const orgId = args[orgIdx + 1];
  const campaignId = args[campaignIdx + 1];

  if (!inputPath || !orgId || !campaignId) {
    console.error("Missing required arguments.");
    process.exit(1);
  }

  // Load JSON
  const fs = await import("fs");
  let records: AirtableRecord[];
  try {
    const raw = fs.readFileSync(inputPath, "utf-8");
    records = JSON.parse(raw) as AirtableRecord[];
  } catch (err) {
    console.error(`Failed to read input file: ${err}`);
    process.exit(1);
  }

  if (!Array.isArray(records)) {
    console.error("Input JSON must be an array of records.");
    process.exit(1);
  }

  console.log(`\n📦 Loaded ${records.length} records from ${inputPath}`);
  console.log(`   Org: ${orgId}`);
  console.log(`   Campaign: ${campaignId}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // Resolve brandId from campaign
  const prisma = new PrismaClient();

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, brandId: true },
    });

    if (!campaign) {
      console.error(`Campaign ${campaignId} not found.`);
      process.exit(1);
    }

    const brandId = campaign.brandId;
    const result: MigrationResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const handle = extractHandle(record);
      const label = handle || extractName(record) || `record[${i}]`;

      if (!handle) {
        result.skipped++;
        console.log(`  ⏭  [${i}] ${label}: no Instagram handle — skipped`);
        continue;
      }

      try {
        if (dryRun) {
          // Log what would happen
          const existing = await prisma.creator.findUnique({
            where: { brandId_instagramHandle: { brandId, instagramHandle: handle } },
          });

          if (existing) {
            console.log(`  🔄 [${i}] @${handle}: would UPDATE existing creator`);
            result.updated++;
          } else {
            console.log(`  ➕ [${i}] @${handle}: would CREATE new creator (status: ${extractStatus(record)})`);
            result.created++;
          }
        } else {
          // Upsert Creator
          const creator = await prisma.creator.upsert({
            where: { brandId_instagramHandle: { brandId, instagramHandle: handle } },
            create: {
              name: extractName(record),
              email: extractEmail(record),
              instagramHandle: handle,
              followerCount: extractFollowerCount(record),
              bio: extractBio(record),
              notes: extractNotes(record),
              discoverySource: "csv_import",
              brandId,
            },
            update: {
              name: extractName(record) ?? undefined,
              email: extractEmail(record) ?? undefined,
              followerCount: extractFollowerCount(record) ?? undefined,
              bio: extractBio(record) ?? undefined,
              notes: extractNotes(record) ?? undefined,
            },
          });

          // Check if it was a create or update (rough heuristic: compare updatedAt vs createdAt)
          const isNew =
            creator.createdAt.getTime() === creator.updatedAt.getTime() ||
            creator.updatedAt.getTime() - creator.createdAt.getTime() < 1000;

          if (isNew) {
            result.created++;
            console.log(`  ➕ [${i}] @${handle}: CREATED`);
          } else {
            result.updated++;
            console.log(`  🔄 [${i}] @${handle}: UPDATED`);
          }

          // Upsert CampaignCreator
          const lifecycleStatus = extractStatus(record);
          await prisma.campaignCreator.upsert({
            where: {
              campaignId_creatorId: { campaignId, creatorId: creator.id },
            },
            create: {
              campaignId,
              creatorId: creator.id,
              reviewStatus: "approved",
              lifecycleStatus,
            },
            update: {
              lifecycleStatus,
            },
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({ record: label, error: errMsg });
        console.error(`  ❌ [${i}] @${handle}: ERROR — ${errMsg}`);
      }
    }

    // Summary
    console.log("\n─── Migration Summary ───");
    console.log(`  Created:  ${result.created}`);
    console.log(`  Updated:  ${result.updated}`);
    console.log(`  Skipped:  ${result.skipped}`);
    console.log(`  Errors:   ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log("\n  Error details:");
      for (const e of result.errors) {
        console.log(`    - ${e.record}: ${e.error}`);
      }
    }

    console.log(`\n${dryRun ? "🔍 DRY RUN complete — no data changed." : "✅ Migration complete."}\n`);

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
