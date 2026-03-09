#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";
import { chromium } from "playwright";
import { Pool } from "pg";
import {
  extractInstagramFollowerCountFromHtml,
  isInstagramProfileBlocked,
} from "../lib/instagram/profile-html";

type TargetCreator = {
  id: string;
  name: string | null;
  instagramHandle: string;
  followerCount: number | null;
  profileFollowerCount: number | null;
};

type RefreshResult = {
  creatorId: string;
  handle: string;
  url: string;
  followerCount: number | null;
  blocked: boolean;
  error: string | null;
};

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const envContent = fs.readFileSync(filePath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([A-Z_a-z][A-Z_a-z0-9]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

function loadEnvironment() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(scriptDir, "../../.env.local"),
    path.resolve(scriptDir, "../.env.local"),
  ];

  for (const candidate of candidates) {
    loadEnvFile(candidate);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);

  const readValue = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    brandId: readValue("--brand-id"),
    campaignId: readValue("--campaign-id"),
    creatorId: readValue("--creator-id"),
    handle: readValue("--handle"),
    limit: Number(readValue("--limit") ?? 25),
    concurrency: Number(readValue("--concurrency") ?? 2),
    dryRun: args.includes("--dry-run"),
    headful: args.includes("--headful"),
    clearOnFailure: args.includes("--clear-on-failure"),
  };
}

async function loadTargets(
  pool: Pool,
  options: ReturnType<typeof parseArgs>
): Promise<TargetCreator[]> {
  if (options.handle) {
    return [
      {
        id: options.handle,
        name: options.handle,
        instagramHandle: options.handle.replace(/^@/, ""),
        followerCount: null,
        profileFollowerCount: null,
      },
    ];
  }

  const whereClauses = ['c.instagram_handle is not null'];
  const values: string[] = [];
  const joinClauses = [
    `left join creator_profiles p
      on p."creatorId" = c.id
      and p.platform = 'instagram'`,
  ];

  if (options.creatorId) {
    values.push(options.creatorId);
    whereClauses.push(`c.id = $${values.length}`);
  }

  if (options.campaignId) {
    values.push(options.campaignId);
    joinClauses.push(
      `join campaign_creators cc
        on cc."creatorId" = c.id`
    );
    whereClauses.push(`cc."campaignId" = $${values.length}`);
  }

  if (options.brandId) {
    values.push(options.brandId);
    whereClauses.push(`c."brandId" = $${values.length}`);
  }

  if (!options.creatorId && !options.campaignId && !options.brandId) {
    throw new Error(
      "Pass one of --brand-id, --campaign-id, --creator-id, or --handle."
    );
  }

  values.push(String(options.limit));
  const query = `
    select
      c.id,
      c.name,
      c.instagram_handle as "instagramHandle",
      c.follower_count as "followerCount",
      p."followerCount" as "profileFollowerCount"
    from creators c
    ${joinClauses.join("\n")}
    where ${whereClauses.join(" and ")}
    order by c."updatedAt" desc
    limit $${values.length}
  `;

  const result = await pool.query<TargetCreator>(query, values);
  return result.rows.map((row) => ({
    ...row,
    instagramHandle: row.instagramHandle.replace(/^@/, ""),
  }));
}

function createProxyConfiguration() {
  const proxyUrls = process.env.CRAWLEE_PROXY_URLS?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!proxyUrls || proxyUrls.length === 0) {
    return undefined;
  }

  return new ProxyConfiguration({ proxyUrls });
}

async function refreshFollowerCounts(
  targets: TargetCreator[],
  options: ReturnType<typeof parseArgs>
) {
  const results = new Map<string, RefreshResult>();

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: targets.length,
    maxConcurrency: Math.max(1, options.concurrency),
    requestHandlerTimeoutSecs: 60,
    navigationTimeoutSecs: 45,
    useSessionPool: true,
    persistCookiesPerSession: true,
    proxyConfiguration: createProxyConfiguration(),
    sessionPoolOptions: {
      maxPoolSize: Math.max(8, options.concurrency * 4),
    },
    browserPoolOptions: {
      useFingerprints: true,
    },
    launchContext: {
      launcher: chromium,
      launchOptions: {
        headless: !options.headful,
      },
    },
    preNavigationHooks: [
      async ({ page }, gotoOptions) => {
        gotoOptions.waitUntil = "domcontentloaded";
        await page.setExtraHTTPHeaders({
          "accept-language": "en-US,en;q=0.9",
        });
      },
    ],
    async requestHandler({ page, request, session, log }) {
      const target = request.userData.target as TargetCreator;

      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600 + Math.floor(Math.random() * 1_200));

      const html = await page.content();
      const followerCount = extractInstagramFollowerCountFromHtml(html);
      const blocked = isInstagramProfileBlocked(html);

      if (followerCount == null) {
        const title = await page.title().catch(() => "");
        if (blocked || /instagram/i.test(title) === false) {
          session?.markBad();
        }

        results.set(target.id, {
          creatorId: target.id,
          handle: target.instagramHandle,
          url: page.url(),
          followerCount: null,
          blocked,
          error: blocked
            ? "blocked_or_login_wall"
            : "follower_count_not_found",
        });
        return;
      }

      log.info(`@${target.instagramHandle} → ${followerCount.toLocaleString()}`);
      results.set(target.id, {
        creatorId: target.id,
        handle: target.instagramHandle,
        url: page.url(),
        followerCount,
        blocked: false,
        error: null,
      });
    },
    async failedRequestHandler({ request, error }) {
      const target = request.userData.target as TargetCreator;
      results.set(target.id, {
        creatorId: target.id,
        handle: target.instagramHandle,
        url: request.url,
        followerCount: null,
        blocked: false,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  await crawler.run(
    targets.map((target) => ({
      url: `https://www.instagram.com/${target.instagramHandle}/`,
      uniqueKey: target.id,
      userData: { target },
    }))
  );

  return targets.map((target) => {
    return (
      results.get(target.id) ?? {
        creatorId: target.id,
        handle: target.instagramHandle,
        url: `https://www.instagram.com/${target.instagramHandle}/`,
        followerCount: null,
        blocked: false,
        error: "no_result",
      }
    );
  });
}

async function persistResults(
  pool: Pool,
  results: RefreshResult[],
  options: ReturnType<typeof parseArgs>
) {
  const timestamp = new Date().toISOString();
  let updated = 0;

  for (const result of results) {
    const shouldClear = result.followerCount == null && options.clearOnFailure;
    if (result.followerCount == null && !shouldClear) continue;

    const nextFollowerCount = shouldClear ? null : result.followerCount;

    await pool.query(
      `
        update creators
        set follower_count = $2,
            "updatedAt" = now()
        where id = $1
      `,
      [result.creatorId, nextFollowerCount]
    );

    await pool.query(
      `
        update creator_profiles
        set "followerCount" = $2,
            metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
            "updatedAt" = now()
        where "creatorId" = $1
          and platform = 'instagram'
      `,
      [
        result.creatorId,
        nextFollowerCount,
        JSON.stringify({
          lastFollowerSyncAt: timestamp,
          lastFollowerSyncSource: "instagram_html",
          lastFollowerSyncUrl: result.url,
          lastFollowerSyncError: result.error,
        }),
      ]
    );

    updated += 1;
  }

  return updated;
}

async function main() {
  loadEnvironment();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const options = parseArgs();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const targets = await loadTargets(pool, options);
    if (targets.length === 0) {
      console.log("No Instagram creators matched the provided scope.");
      return;
    }

    console.log(
      `Refreshing Instagram follower counts for ${targets.length} creator(s) with concurrency ${Math.max(1, options.concurrency)}${options.dryRun ? " [dry-run]" : ""}.`
    );

    const results = await refreshFollowerCounts(targets, options);
    const successful = results.filter((result) => result.followerCount != null);
    const failed = results.filter((result) => result.followerCount == null);

    for (const result of results) {
      const outcome =
        result.followerCount != null
          ? result.followerCount.toLocaleString()
          : `ERROR: ${result.error}`;
      console.log(`@${result.handle} → ${outcome}`);
    }

    if (options.dryRun) {
      console.log(
        `Dry run complete. Successful: ${successful.length}. Failed: ${failed.length}.`
      );
      return;
    }

    const updated = await persistResults(pool, results, options);
    console.log(
      `Follower refresh complete. Updated ${updated} creator(s); ${failed.length} failed.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
