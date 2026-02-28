import path from 'path';
import { chromium } from 'playwright';
import { loadConfig, VIEWPORTS } from '../config.js';
import { ensureDir, writeJson } from '../utils/fs.js';
import { fetchSitemapUrlsFromXml } from '../utils/robots.js';
import { crawlSite } from '../utils/crawl.js';
import { normalizeUrl, routeKeyFromUrl } from '../utils/url.js';
import { attachCssCollector } from '../capture/css.js';
import { captureBaseline } from '../capture/baseline.js';
import { captureMotion } from '../capture/motion.js';
import { extractTokens, type TokenExtraction } from '../capture/tokens.js';
import { buildAnimationInventory } from '../capture/animations.js';
import { detectChallenge } from '../utils/challenge.js';
import { createRunSummary, writeRunSummary } from '../utils/run-summary.js';
import { sleep } from '../utils/time.js';

interface RouteEntry {
  url: string;
  finalUrl: string;
  status: number | 'blocked';
  title: string;
  routeKey: string;
  discoveredFrom: string;
  note?: string;
}

async function discoverRoutes(baseUrl: string, maxDepth: number, maxRoutes: number) {
  const sitemapUrl = new URL('/sitemap.xml', baseUrl).toString();
  const sitemapEntries = await fetchSitemapUrlsFromXml(sitemapUrl);
  if (sitemapEntries.length) {
    return sitemapEntries.slice(0, maxRoutes).map((url) => ({ url: normalizeUrl(url), discoveredFrom: 'sitemap' }));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const crawlEntries = await crawlSite(page, { baseUrl, maxDepth, maxRoutes, rateLimitMs: 500 });
  await browser.close();

  return crawlEntries.map((url) => ({ url: normalizeUrl(url), discoveredFrom: 'crawl' }));
}

function mergeTokenAggregate(aggregate: TokenExtraction, tokens: TokenExtraction): TokenExtraction {
  const mergeCounts = (target: { value: string; count: number }[], incoming: { value: string; count: number }[]) => {
    const map = new Map(target.map((item) => [item.value, item.count]));
    for (const item of incoming) {
      map.set(item.value, (map.get(item.value) || 0) + item.count);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  };

  return {
    fonts: Array.from(new Set([...aggregate.fonts, ...tokens.fonts])),
    typography: [...aggregate.typography, ...tokens.typography],
    colors: mergeCounts(aggregate.colors, tokens.colors),
    radii: mergeCounts(aggregate.radii, tokens.radii),
    shadows: mergeCounts(aggregate.shadows, tokens.shadows),
  };
}

async function run() {
  const config = loadConfig();
  const runSummary = createRunSummary(config);
  const baseDir = path.join('artifacts', config.runId, 'competitors');
  await ensureDir(baseDir);

  const browser = await chromium.launch({ headless: config.headless });

  for (const site of config.competitors) {
    const siteDir = path.join(baseDir, site.id);
    await ensureDir(siteDir);

    const discovered = await discoverRoutes(site.baseUrl, config.maxDepth, config.maxRoutes);
    const routes: RouteEntry[] = [];
    const aggregatedTokens: TokenExtraction = { fonts: [], typography: [], colors: [], radii: [], shadows: [] };
    const allCssTexts: string[] = [];

    let motionCount = 0;
    const motionLimit = Number(process.env.COMPETITOR_MOTION_LIMIT ?? 3);

    for (const entry of discovered) {
      const routeKey = routeKeyFromUrl(entry.url);
      const routeDir = path.join(siteDir, routeKey);
      await ensureDir(routeDir);

      const context = await browser.newContext({
        viewport: VIEWPORTS.desktop,
        deviceScaleFactor: config.deviceScaleFactor,
      });
      const page = await context.newPage();
      const cssCollector = attachCssCollector(page);

      const response = await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const blocked = await detectChallenge(page, response);
      const finalUrl = page.url();
      const title = await page.title();

      if (blocked) {
        const screenshotPath = path.join(routeDir, 'blocked.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        routes.push({
          url: entry.url,
          finalUrl,
          status: 'blocked',
          title,
          routeKey,
          discoveredFrom: entry.discoveredFrom,
          note: 'Cloudflare/Turnstile challenge detected. Run headed and solve manually.',
        });
        await context.close();
        console.warn(`⚠️ Challenge detected at ${entry.url}. Skipping.`);
        await sleep(config.rateLimitMs);
        continue;
      }

      await captureBaseline(page, { outDir: routeDir, viewportName: 'desktop' });

      if ((config.captureMode === 'motion' || config.captureMode === 'both') && motionCount < motionLimit) {
        await captureMotion(page, { outDir: routeDir, viewportName: 'desktop' });
        motionCount += 1;
      }

      const tokens = await extractTokens(page);
      await writeJson(path.join(routeDir, 'tokens.json'), tokens);
      Object.assign(aggregatedTokens, mergeTokenAggregate(aggregatedTokens, tokens));
      allCssTexts.push(...cssCollector.cssTexts);

      routes.push({
        url: entry.url,
        finalUrl,
        status: response?.status() ?? 0,
        title,
        routeKey,
        discoveredFrom: entry.discoveredFrom,
      });

      cssCollector.stop();
      await context.close();
      await sleep(config.rateLimitMs);
    }

    await writeJson(path.join(siteDir, 'routes.json'), routes);
    await writeJson(path.join(siteDir, 'typography.json'), aggregatedTokens);
    await writeJson(path.join(siteDir, 'motion.json'), buildAnimationInventory(allCssTexts));

    runSummary.outputs.push(path.join(siteDir, 'routes.json'));
  }

  runSummary.finishedAt = new Date().toISOString();
  await writeRunSummary(config.runId, runSummary);
  await browser.close();

  console.log('✅ Competitor audit complete');
}

run().catch((error) => {
  console.error('audit:competitors failed', error);
  process.exit(1);
});
