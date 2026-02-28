import path from 'path';
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
  if (!raw) return 20;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

async function waitForLogin(page: import('playwright').Page, platformHost: string, timeoutMs: number) {
  console.log('🔐 Complete Google OAuth login in the opened browser window.');
  await page.waitForFunction((expectedHost) => {
    const path = window.location.pathname;
    return window.location.host === expectedHost && !path.includes('login') && !path.includes('signup');
  }, platformHost, { timeout: timeoutMs });
}

async function run() {
  const config = loadConfig();
  await ensureDir('.auth');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loginTimeoutMs = getLoginTimeoutMs();
  await page.goto(new URL('/login', config.platformBaseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await waitForLogin(page, new URL(config.platformBaseUrl).host, loginTimeoutMs);

  const afterLoginPath = path.join('.auth', 'platform.afterLogin.storageState.json');
  await context.storageState({ path: afterLoginPath });
  console.log(`✅ Saved storage state: ${afterLoginPath}`);

  if (!page.url().includes('/onboarding')) {
    const onboardingUrl = new URL('/onboarding', config.platformBaseUrl).toString();
    await page.goto(onboardingUrl, { waitUntil: 'domcontentloaded' });
  }

  const flowDir = path.join('artifacts', config.runId, 'platform', 'flows', 'onboarding');
  await ensureDir(flowDir);

  const steps = await recordFlow(page, {
    flowName: 'onboarding',
    outDir: flowDir,
    maxSteps: getMaxFlowSteps(),
    allowWrites: config.allowWrites,
  });

  const onboardingComplete = page.url().includes('dashboard');
  const afterOnboardingPath = path.join('.auth', 'platform.afterOnboarding.storageState.json');
  await context.storageState({ path: afterOnboardingPath });
  await writeJson(path.join('.auth', 'platform.afterOnboarding.meta.json'), { onboardingComplete });

  const docPath = path.join('docs', 'audit', 'flows', 'platform', 'onboarding.md');
  await ensureDir(path.dirname(docPath));
  const rows = steps
    .map((step) => `| ${step.index} | ${step.stepLabel || step.title} | ${step.action || ''} | ${step.screenshot} |`)
    .join('\n');
  const markdown = `# Onboarding Flow\n\n| Step | Label | Action | Screenshot |\n|---|---|---|---|\n${rows}\n`;
  await writeText(docPath, markdown);

  await browser.close();
  console.log(`✅ Onboarding captured (${steps.length} steps). Storage state saved.`);
}

run().catch((error) => {
  console.error('audit:platform:bootstrap failed', error);
  process.exit(1);
});
