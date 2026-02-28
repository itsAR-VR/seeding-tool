import path from 'path';
import { chromium } from 'playwright';
import { loadConfig, VIEWPORTS } from '../config.js';
import { ensureDir, writeJson } from '../utils/fs.js';
import { normalizeUrl, routeKeyFromUrl } from '../utils/url.js';
import { captureBaseline } from '../capture/baseline.js';
import { captureMotion } from '../capture/motion.js';
import { attachRequestLogger, scrubHar } from '../capture/network.js';
import { createRunSummary, writeRunSummary } from '../utils/run-summary.js';
import { ensureNameHelper } from '../utils/page.js';

interface RouteEntry {
  url: string;
  finalUrl: string;
  status: number;
  title: string;
  routeKey: string;
  primaryActions: string[];
}

async function collectInternalLinks(page: import('playwright').Page, baseUrl: string): Promise<string[]> {
  return page.evaluate((origin) => {
    const links = Array.from(document.querySelectorAll('a[href]')).map((anchor) => (anchor as HTMLAnchorElement).href);
    return links.filter((href) => href.startsWith(origin));
  }, baseUrl);
}

async function collectPrimaryActions(page: import('playwright').Page): Promise<string[]> {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('button'))
      .map((btn) => (btn as HTMLButtonElement).innerText?.trim())
      .filter(Boolean);
    const filtered = labels.filter((label) => /create|new|add|next|save|publish|start/i.test(label));
    return Array.from(new Set(filtered));
  });
}

async function run() {
  const config = loadConfig();
  const runSummary = createRunSummary(config);
  const platformDir = path.join('artifacts', config.runId, 'platform');
  const networkDir = path.join(platformDir, 'network');
  await ensureDir(platformDir);
  await ensureDir(networkDir);

  const storageStatePath = path.join('.auth', 'platform.afterOnboarding.storageState.json');

  const browser = await chromium.launch({ headless: config.headless });
  const rawHarPath = path.join(networkDir, 'platform.raw.har');
  const context = await browser.newContext({
    storageState: storageStatePath,
    recordHar: { path: rawHarPath, content: 'omit' },
  });
  const page = await context.newPage();
  await ensureNameHelper(page);
  const logger = attachRequestLogger(page);

  const dashboardUrl = new URL('/', config.platformBaseUrl).toString();
  await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });

  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(page.url())];
  const routes: RouteEntry[] = [];

  while (queue.length && routes.length < config.maxRoutes) {
    const current = queue.shift();
    if (!current) break;
    const normalized = normalizeUrl(current);
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    const response = await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response?.status() ?? 0;
    const title = await page.title();
    const finalUrl = page.url();
    const routeKey = routeKeyFromUrl(finalUrl);
    const routeDir = path.join(platformDir, routeKey);
    await ensureDir(routeDir);

    const actions = await collectPrimaryActions(page);

    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await captureBaseline(page, { outDir: routeDir, viewportName });
      if ((config.captureMode === 'motion' || config.captureMode === 'both') && viewportName === 'desktop') {
        await captureMotion(page, { outDir: routeDir, viewportName });
      }
    }

    routes.push({
      url: normalized,
      finalUrl,
      status,
      title,
      routeKey,
      primaryActions: actions,
    });

    const links = await collectInternalLinks(page, config.platformBaseUrl);
    for (const link of links) {
      const candidate = normalizeUrl(link);
      if (!visited.has(candidate) && candidate.startsWith(config.platformBaseUrl)) {
        queue.push(candidate);
      }
    }
  }

  await logger.flush(path.join(networkDir, 'requests.jsonl'));
  await writeJson(path.join(platformDir, 'routes.json'), routes);

  await context.close();
  await browser.close();

  const scrubbedHarPath = path.join(networkDir, 'platform.har');
  await scrubHar(rawHarPath, scrubbedHarPath);

  runSummary.outputs.push(path.join(platformDir, 'routes.json'));
  runSummary.outputs.push(scrubbedHarPath);
  runSummary.outputs.push(path.join(networkDir, 'requests.jsonl'));
  runSummary.finishedAt = new Date().toISOString();
  await writeRunSummary(config.runId, runSummary);

  console.log(`✅ Platform audit complete. Routes: ${routes.length}`);
}

run().catch((error) => {
  console.error('audit:platform failed', error);
  process.exit(1);
});
