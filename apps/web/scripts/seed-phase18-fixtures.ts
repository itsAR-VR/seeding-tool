#!/usr/bin/env tsx
/**
 * Phase 18 QA Fixture Seed
 *
 * Creates a test user, org, client, brand, campaign, and 5 approved CampaignCreator
 * records for visual evidence of Finding 5 (bulk draft-review) and Finding 6
 * (connection validation feedback).
 *
 * Usage:
 *   cd apps/web && npx tsx scripts/seed-phase18-fixtures.ts
 */

import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env from apps/web
dotenv.config({ path: resolve(import.meta.dirname ?? __dirname, "../.env") });

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const prisma = createClient();

const FIXTURES = {
  user: {
    id: "phase18-qa-user-001",
    email: "qa-phase18@seedscale.test",
    name: "Phase 18 QA User",
  },
  org: {
    id: "phase18-qa-org-001",
    name: "Phase 18 QA Org",
    slug: "phase18-qa-org",
  },
  client: {
    id: "phase18-qa-client-001",
    name: "Phase 18 QA Client",
  },
  brand: {
    id: "phase18-qa-brand-001",
    name: "Phase 18 QA Brand",
    slug: "phase18-qa-brand",
  },
  campaign: {
    id: "phase18-qa-campaign-001",
    name: "Phase 18 Bulk Select Test Campaign",
    status: "active",
  },
  creators: [
    { id: "phase18-cr-001", name: "Sophia Chen", email: "sophia@example.com", instagramHandle: "sophiachen_fitness", followerCount: 125000 },
    { id: "phase18-cr-002", name: "Marcus Rivera", email: "marcus@example.com", instagramHandle: "marcusrivera_style", followerCount: 89000 },
    { id: "phase18-cr-003", name: "Aya Tanaka", email: "aya@example.com", instagramHandle: "ayatanaka_beauty", followerCount: 210000 },
    { id: "phase18-cr-004", name: "Liam O'Brien", email: "liam@example.com", instagramHandle: "liamobrien_travel", followerCount: 67000 },
    { id: "phase18-cr-005", name: "Priya Sharma", email: "priya@example.com", instagramHandle: "priyasharma_food", followerCount: 153000 },
  ],
};

async function main() {
  console.log("🌱 Seeding Phase 18 QA fixtures...\n");

  // 1. User
  const user = await prisma.user.upsert({
    where: { id: FIXTURES.user.id },
    update: {},
    create: FIXTURES.user,
  });
  console.log(`  ✅ User: ${user.email}`);

  // 2. Organization
  const org = await prisma.organization.upsert({
    where: { id: FIXTURES.org.id },
    update: {},
    create: FIXTURES.org,
  });
  console.log(`  ✅ Organization: ${org.name}`);

  // 3. Org membership
  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: "owner",
    },
  });
  console.log(`  ✅ OrgMembership: owner`);

  // 4. Client
  const client = await prisma.client.upsert({
    where: { id: FIXTURES.client.id },
    update: {},
    create: {
      ...FIXTURES.client,
      organizationId: org.id,
    },
  });
  console.log(`  ✅ Client: ${client.name}`);

  // 5. Brand
  const brand = await prisma.brand.upsert({
    where: { id: FIXTURES.brand.id },
    update: {},
    create: {
      ...FIXTURES.brand,
      clientId: client.id,
    },
  });
  console.log(`  ✅ Brand: ${brand.name}`);

  // 6. Brand membership
  await prisma.brandMembership.upsert({
    where: { userId_brandId: { userId: user.id, brandId: brand.id } },
    update: {},
    create: {
      userId: user.id,
      brandId: brand.id,
      role: "owner",
    },
  });
  console.log(`  ✅ BrandMembership: owner`);

  // 7. Campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: FIXTURES.campaign.id },
    update: {},
    create: {
      ...FIXTURES.campaign,
      brandId: brand.id,
    },
  });
  console.log(`  ✅ Campaign: ${campaign.name} (id: ${campaign.id})`);

  // 8. Creators + CampaignCreators (approved + ready)
  for (const cr of FIXTURES.creators) {
    const creator = await prisma.creator.upsert({
      where: { id: cr.id },
      update: { name: cr.name, email: cr.email, followerCount: cr.followerCount },
      create: {
        id: cr.id,
        name: cr.name,
        email: cr.email,
        instagramHandle: cr.instagramHandle,
        followerCount: cr.followerCount,
        discoverySource: "manual",
        brandId: brand.id,
      },
    });

    await prisma.campaignCreator.upsert({
      where: { campaignId_creatorId: { campaignId: campaign.id, creatorId: creator.id } },
      update: { reviewStatus: "approved", lifecycleStatus: "ready" },
      create: {
        campaignId: campaign.id,
        creatorId: creator.id,
        reviewStatus: "approved",
        lifecycleStatus: "ready",
      },
    });

    console.log(`  ✅ Creator: ${cr.name} (${cr.followerCount.toLocaleString()} followers) → approved/ready`);
  }

  // 9. Brand settings (needed for pages to render)
  await prisma.brandSettings.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
      brandVoice: "Friendly and professional",
    },
  });
  console.log(`  ✅ BrandSettings: created`);

  console.log(`\n🎯 Fixture summary:`);
  console.log(`   Campaign ID: ${campaign.id}`);
  console.log(`   Brand slug:  ${brand.slug}`);
  console.log(`   Creators:    ${FIXTURES.creators.length} (all approved/ready)`);
  console.log(`\n   Outreach URL: http://localhost:3000/campaigns/${campaign.id}/outreach`);
  console.log(`   Connections:  http://localhost:3000/settings/connections`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
