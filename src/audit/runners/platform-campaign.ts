import path from 'path';
import { readFile } from 'fs/promises';
import { chromium } from 'playwright';
import { loadConfig } from '../config.js';
import { ensureDir, writeJson, writeText } from '../utils/fs.js';
import { captureUnauthFlowBaseline, recordFlow } from '../capture/flow.js';

const ALLOW_UNAUTH_BASELINE_ENV = 'AUDIT_ALLOW_UNAUTH_BASELINE';

function getLoginTimeoutMs() {
  const raw = process.env.LOGIN_TIMEOUT_MS?.trim();
  if (!raw) return 20 * 60 * 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20 * 60 * 1000;
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
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

function buildMissingAuthErrorMessage(): string {
  return [
    'Missing platform auth storage state for `audit:platform:campaign`.',
    'Expected one of:',
    '- `.auth/platform.afterOnboarding.storageState.json`',
    '- `.auth/platform.afterLogin.storageState.json`',
    'Next steps:',
    '1) Run `npm run audit:platform:bootstrap` in headed mode and complete login/onboarding.',
    '2) Re-run `npm run audit:platform:campaign`.',
    `Optional baseline-only fallback: set ${ALLOW_UNAUTH_BASELINE_ENV}=1 to capture only the unauthenticated /campaign entry state.`,
  ].join('\n');
}

async function run() {
  const config = loadConfig();
  await ensureDir('.auth');

  const afterOnboardingPath = path.join('.auth', 'platform.afterOnboarding.storageState.json');
  const afterLoginPath = path.join('.auth', 'platform.afterLogin.storageState.json');
  const flowDir = path.join('artifacts', config.runId, 'platform', 'flows', 'campaign-create');
  await ensureDir(flowDir);
  const allowUnauthBaseline = parseBooleanFlag(process.env[ALLOW_UNAUTH_BASELINE_ENV]);

  let storageStatePath: string | undefined;
  if (await fileExists(afterOnboardingPath)) {
    storageStatePath = afterOnboardingPath;
  } else if (await fileExists(afterLoginPath)) {
    storageStatePath = afterLoginPath;
  }

  if (!storageStatePath && !allowUnauthBaseline) {
    throw new Error(buildMissingAuthErrorMessage());
  }

  if (!storageStatePath && allowUnauthBaseline) {
    const browser = await chromium.launch({ headless: config.headless });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(new URL('/campaign', config.platformBaseUrl).toString(), { waitUntil: 'domcontentloaded' });

    const steps = await captureUnauthFlowBaseline(page, {
      flowName: 'campaign-create',
      outDir: flowDir,
      reason:
        'Auth storage state is missing. This run captured the unauthenticated baseline only. Run `npm run audit:platform:bootstrap` and rerun `npm run audit:platform:campaign` for full flow capture.',
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
    console.log(`⚠️ Captured unauthenticated campaign baseline (${steps.length} step).`);
    return;
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
