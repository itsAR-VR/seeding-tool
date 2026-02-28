import path from 'path';
import { chromium } from 'playwright';
import { loadConfig, VIEWPORTS } from '../config.js';
import { ensureDir, writeJson } from '../utils/fs.js';
import { fetchSitemapUrls, fetchSitemapUrlsFromXml } from '../utils/robots.js';
import { crawlSite } from '../utils/crawl.js';
import { normalizeUrl, routeKeyFromUrl } from '../utils/url.js';
import { attachCssCollector } from '../capture/css.js';
import { captureBaseline } from '../capture/baseline.js';
import { captureMotion } from '../capture/motion.js';
import { extractTokens, type TokenExtraction } from '../capture/tokens.js';
import { buildAnimationInventory } from '../capture/animations.js';
import { createRunSummary, writeRunSummary } from '../utils/run-summary.js';

interface RouteEntry {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  routeKey: string;
  discoveredFrom: string[];
  note?: string;
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

async function discoverMarketingRoutes(baseUrl: string, maxDepth: number, maxRoutes: number) {
  const sitemapUrls = await fetchSitemapUrls(baseUrl);
  const sitemapEntries: string[] = [];
  for (const sitemapUrl of sitemapUrls) {
    const urls = await fetchSitemapUrlsFromXml(sitemapUrl);
    sitemapEntries.push(...urls);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const crawlEntries = await crawlSite(page, { baseUrl, maxDepth, maxRoutes, rateLimitMs: 200 });
  await browser.close();

  const routeMap = new Map<string, RouteEntry>();
  const addRoute = (url: string, source: string) => {
    const normalized = normalizeUrl(url);
    const existing = routeMap.get(normalized);
    if (existing) {
      if (!existing.discoveredFrom.includes(source)) existing.discoveredFrom.push(source);
      return;
    }
    routeMap.set(normalized, {
      url: normalized,
      finalUrl: normalized,
      status: 0,
      title: '',
      routeKey: routeKeyFromUrl(normalized),
      discoveredFrom: [source],
    });
  };

  sitemapEntries.forEach((url) => addRoute(url, 'sitemap'));
  crawlEntries.forEach((url) => addRoute(url, 'crawl'));

  return Array.from(routeMap.values()).slice(0, maxRoutes);
}

async function run() {
  const config = loadConfig();
  const runSummary = createRunSummary(config);

  const marketingDir = path.join('artifacts', config.runId, 'marketing');
  await ensureDir(marketingDir);

  const browser = await chromium.launch({ headless: config.headless });

  const routes = await discoverMarketingRoutes(config.marketingBaseUrl, config.maxDepth, config.maxRoutes);
  const aggregatedTokens: TokenExtraction = {
    fonts: [],
    typography: [],
    colors: [],
    radii: [],
    shadows: [],
  };
  const allCssTexts: string[] = [];

  for (const route of routes) {
    const routeDir = path.join(marketingDir, route.routeKey);
    await ensureDir(routeDir);

    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: config.deviceScaleFactor,
      });
      const page = await context.newPage();
      const cssCollector = attachCssCollector(page);

      const response = await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      route.status = response?.status() ?? 0;
      route.finalUrl = page.url();
      route.title = await page.title();

      await captureBaseline(page, { outDir: routeDir, viewportName });

      if (config.captureMode === 'motion' || config.captureMode === 'both') {
        await captureMotion(page, { outDir: routeDir, viewportName });
      }

      if (viewportName === 'desktop') {
        const tokens = await extractTokens(page);
        const tokenPath = path.join(routeDir, 'tokens.json');
        await writeJson(tokenPath, tokens);
        Object.assign(aggregatedTokens, mergeTokenAggregate(aggregatedTokens, tokens));
        allCssTexts.push(...cssCollector.cssTexts);
      }

      cssCollector.stop();
      await context.close();
    }
  }

  const animationInventory = buildAnimationInventory(allCssTexts);
  await writeJson(path.join(marketingDir, 'tokens.json'), aggregatedTokens);
  await writeJson(path.join(marketingDir, 'animations.json'), animationInventory);
  await writeJson(path.join(marketingDir, 'routes.json'), routes);

  runSummary.outputs.push(path.join(marketingDir, 'routes.json'));
  runSummary.outputs.push(path.join(marketingDir, 'tokens.json'));
  runSummary.outputs.push(path.join(marketingDir, 'animations.json'));
  runSummary.finishedAt = new Date().toISOString();
  await writeRunSummary(config.runId, runSummary);

  await browser.close();
  console.log(`✅ Marketing audit complete. Routes: ${routes.length}`);
}

run().catch((error) => {
  console.error('audit:marketing failed', error);
  process.exit(1);
});
