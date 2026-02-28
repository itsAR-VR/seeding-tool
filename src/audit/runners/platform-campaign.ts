import path from 'path';
import { readFile } from 'fs/promises';
import { chromium } from 'playwright';
import { loadConfig } from '../config.js';
import { ensureDir, writeJson, writeText } from '../utils/fs.js';
import { recordFlow } from '../capture/flow.js';

function getLoginTimeoutMs() {
  const raw = process.env.LOGIN_TIMEOUT_MS?.trim();
  if (!raw) return 20 * 60 * 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20 * 60 * 1000;
}

function getMaxFlowSteps() {
  const raw = process.env.FLOW_MAX_STEPS?.trim();
  if (!raw) return 40;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 40;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForLogin(page: import('playwright').Page, platformHost: string, timeoutMs: number) {
  console.log('🔐 If prompted, complete login in the opened browser window.');
  await page.waitForFunction((expectedHost) => {
    const path = window.location.pathname;
    return window.location.host === expectedHost && !path.includes('login') && !path.includes('signup');
  }, platformHost, { timeout: timeoutMs });
}

async function run() {
  const config = loadConfig();
  await ensureDir('.auth');

  const afterOnboardingPath = path.join('.auth', 'platform.afterOnboarding.storageState.json');
  const afterLoginPath = path.join('.auth', 'platform.afterLogin.storageState.json');
  const storageStatePath = (await fileExists(afterOnboardingPath)) ? afterOnboardingPath : afterLoginPath;

  if (!(await fileExists(storageStatePath))) {
    console.error('No storage state found. Run `npm run audit:platform:bootstrap` first.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: storageStatePath,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const loginTimeoutMs = getLoginTimeoutMs();
  await page.goto(new URL('/campaign', config.platformBaseUrl).toString(), { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login') || page.url().includes('/signup')) {
    await waitForLogin(page, new URL(config.platformBaseUrl).host, loginTimeoutMs);
    await page.goto(new URL('/campaign', config.platformBaseUrl).toString(), { waitUntil: 'domcontentloaded' });
  }

  console.log('🧭 Navigate the campaign creation flow in the browser (use sample data where possible).');

  const flowDir = path.join('artifacts', config.runId, 'platform', 'flows', 'campaign-create');
  await ensureDir(flowDir);

  const steps = await recordFlow(page, {
    flowName: 'campaign-create',
    outDir: flowDir,
    maxSteps: getMaxFlowSteps(),
    allowWrites: config.allowWrites,
  });

  const docPath = path.join('docs', 'audit', 'flows', 'platform', 'campaign-create.md');
  await ensureDir(path.dirname(docPath));
  const rows = steps
    .map((step) => `| ${step.index} | ${step.stepLabel || step.title} | ${step.action || ''} | ${step.screenshot} |`)
    .join('\n');
  const markdown = `# Campaign Creation Flow\n\n| Step | Label | Action | Screenshot |\n|---|---|---|---|\n${rows}\n`;
  await writeText(docPath, markdown);

  await writeJson(path.join(flowDir, 'steps.json'), steps);

  await browser.close();
  console.log(`✅ Campaign flow captured (${steps.length} steps).`);
}

run().catch((error) => {
  console.error('audit:platform:campaign failed', error);
  process.exit(1);
});
