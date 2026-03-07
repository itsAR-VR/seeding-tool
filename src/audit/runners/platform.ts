import path from 'path';
import { readFile } from 'fs/promises';
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

const ALLOW_UNAUTH_BASELINE_ENV = 'AUDIT_ALLOW_UNAUTH_BASELINE';

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveStorageStatePath(paths: string[]): Promise<string | undefined> {
  for (const filePath of paths) {
    if (await fileExists(filePath)) return filePath;
  }
  return undefined;
}

function buildMissingAuthErrorMessage(): string {
  return [
    'Missing platform auth storage state for `audit:platform`.',
    'Expected one of:',
    '- `.auth/platform.afterOnboarding.storageState.json`',
    '- `.auth/platform.afterLogin.storageState.json`',
    'Next steps:',
    '1) Run `npm run audit:platform:bootstrap` in headed mode and complete login/onboarding.',
    '2) Re-run `npm run audit:platform`.',
    `Optional baseline-only fallback: set ${ALLOW_UNAUTH_BASELINE_ENV}=1 to capture a single unauthenticated baseline route.`,
  ].join('\n');
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

  const allowUnauthBaseline = parseBooleanFlag(process.env[ALLOW_UNAUTH_BASELINE_ENV]);
  const storageStatePath = await resolveStorageStatePath([
    path.join('.auth', 'platform.afterOnboarding.storageState.json'),
    path.join('.auth', 'platform.afterLogin.storageState.json'),
  ]);
  if (!storageStatePath && !allowUnauthBaseline) {
    throw new Error(buildMissingAuthErrorMessage());
  }
  if (!storageStatePath && allowUnauthBaseline) {
    console.warn(
      `⚠️ ${ALLOW_UNAUTH_BASELINE_ENV}=1 set and no auth state found. Running unauthenticated baseline capture for the initial route only.`,
    );
  }

  const browser = await chromium.launch({ headless: config.headless });
  const rawHarPath = path.join(networkDir, 'platform.raw.har');
  const context = await browser.newContext({
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
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
  const maxRoutes = storageStatePath ? config.maxRoutes : 1;

  while (queue.length && routes.length < maxRoutes) {
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

    if (!storageStatePath) {
      continue;
    }

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

  if (storageStatePath) {
    console.log(`✅ Platform audit complete. Routes: ${routes.length}`);
    return;
  }
  console.log(`⚠️ Platform unauthenticated baseline capture complete. Routes: ${routes.length}`);
}

run().catch((error) => {
  console.error('audit:platform failed', error);
  process.exit(1);
});
