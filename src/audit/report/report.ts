import path from 'path';
import { readdir, readFile } from 'fs/promises';
import { loadConfig } from '../config.js';
import { ensureDir, writeText } from '../utils/fs.js';
import { writeBlueprints } from './blueprints.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveRunId(defaultRunId: string): Promise<string | null> {
  const artifactsDir = 'artifacts';
  try {
    const entries = await readdir(artifactsDir, { withFileTypes: true });
    const runs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    if (runs.includes(defaultRunId)) return defaultRunId;
    return runs[0] || null;
  } catch {
    return null;
  }
}

function summarizeTokens(tokens: any): string {
  if (!tokens) return 'No token data captured.';
  const fonts = (tokens.fonts || []).slice(0, 5).join(', ');
  const colors = (tokens.colors || []).slice(0, 5).map((c: any) => c.value).join(', ');
  return `Fonts: ${fonts || 'n/a'}\nColors: ${colors || 'n/a'}`;
}

async function writePageDoc(params: {
  docPath: string;
  route: any;
  tokensPath?: string;
  artifactsDir: string;
}) {
  const tokens = params.tokensPath ? await readJson<any>(params.tokensPath) : null;
  const artifacts = params.artifactsDir;
  const content = `# ${params.route.title || params.route.routeKey}\n\n` +
    `- URL: ${params.route.finalUrl || params.route.url}\n` +
    `- Status: ${params.route.status}\n` +
    `- Route Key: ${params.route.routeKey}\n\n` +
    `## Structure Outline\n` +
    `- See DOM snapshot in ${artifacts}\n\n` +
    `## Typography + Color Summary\n` +
    `${summarizeTokens(tokens)}\n\n` +
    `## Artifacts\n` +
    `- Screenshots/DOM: ${artifacts}\n`;
  await ensureDir(path.dirname(params.docPath));
  await writeText(params.docPath, content);
}

async function writeRunbook() {
  const runbookPath = path.join('docs', 'audit', 'runbook.md');
  const content = `# Audit Runbook\n\n` +
    `## Environment Variables\n` +
    `- RUN_ID (defaults to timestamp)\n` +
    `- AHA_MARKETING_BASE_URL\n` +
    `- AHA_PLATFORM_BASE_URL\n` +
    `- COMPETITOR_SITES\n` +
    `- CAPTURE_MODE (baseline|motion|both)\n` +
    `- MAX_ROUTES, MAX_DEPTH, RATE_LIMIT_MS\n` +
    `- ALLOW_DESTRUCTIVE, ALLOW_WRITES\n\n` +
    `## OAuth Bootstrap\n` +
    `Run \`npm run audit:platform:bootstrap\` in headed mode. Complete Google login manually, then proceed through onboarding and select sample data.\n\n` +
    `## Anti-bot Hygiene (Competitors)\n` +
    `- Run headed mode (HEADLESS=false)\n` +
    `- Use RATE_LIMIT_MS 500–1500\n` +
    `- If challenge detected, solve manually and rerun\n\n` +
    `## Safety Flags\n` +
    `- ALLOW_DESTRUCTIVE=0 by default\n` +
    `- ALLOW_WRITES=1 only for safe onboarding/test data\n`;
  await ensureDir(path.dirname(runbookPath));
  await writeText(runbookPath, content);
}

async function run() {
  const config = loadConfig();
  const runId = await resolveRunId(config.runId);
  if (!runId) {
    console.warn('No artifacts found. Run an audit first.');
    return;
  }

  const docsRoot = path.join('docs', 'audit');
  await ensureDir(docsRoot);

  const marketingRoutes = await readJson<any[]>(path.join('artifacts', runId, 'marketing', 'routes.json'));
  if (marketingRoutes) {
    for (const route of marketingRoutes) {
      const docPath = path.join(docsRoot, 'pages', 'marketing', `${route.routeKey}.md`);
      const tokensPath = path.join('artifacts', runId, 'marketing', route.routeKey, 'tokens.json');
      const marketingDocParams: { docPath: string; route: any; artifactsDir: string; tokensPath?: string } = {
        docPath,
        route,
        artifactsDir: path.join('artifacts', runId, 'marketing', route.routeKey),
      };
      if (await fileExists(tokensPath)) marketingDocParams.tokensPath = tokensPath;
      await writePageDoc(marketingDocParams);
    }
  }

  const platformRoutes = await readJson<any[]>(path.join('artifacts', runId, 'platform', 'routes.json'));
  if (platformRoutes) {
    for (const route of platformRoutes) {
      const docPath = path.join(docsRoot, 'pages', 'platform', `${route.routeKey}.md`);
      await writePageDoc({
        docPath,
        route,
        artifactsDir: path.join('artifacts', runId, 'platform', route.routeKey),
      });
    }
  }

  const competitorsDir = path.join('artifacts', runId, 'competitors');
  try {
    const competitorEntries = await readdir(competitorsDir, { withFileTypes: true });
    for (const entry of competitorEntries) {
      if (!entry.isDirectory()) continue;
      const siteId = entry.name;
      const routes = await readJson<any[]>(path.join(competitorsDir, siteId, 'routes.json'));
      if (!routes) continue;
      for (const route of routes) {
        const docPath = path.join(docsRoot, 'pages', 'competitors', siteId, `${route.routeKey}.md`);
        const tokensPath = path.join(competitorsDir, siteId, route.routeKey, 'tokens.json');
        const competitorDocParams: { docPath: string; route: any; artifactsDir: string; tokensPath?: string } = {
          docPath,
          route,
          artifactsDir: path.join(competitorsDir, siteId, route.routeKey),
        };
        if (await fileExists(tokensPath)) competitorDocParams.tokensPath = tokensPath;
        await writePageDoc(competitorDocParams);
      }
    }
  } catch {
    // no competitor artifacts yet
  }

  const indexPath = path.join(docsRoot, 'index.md');
  const indexContent = `# Audit Index\n\n` +
    `Run ID: ${runId}\n\n` +
    `- Marketing pages: docs/audit/pages/marketing\n` +
    `- Platform pages: docs/audit/pages/platform\n` +
    `- Competitor pages: docs/audit/pages/competitors\n`;
  await writeText(indexPath, indexContent);

  await writeRunbook();
  await writeBlueprints(runId);

  console.log(`✅ Audit docs generated for run ${runId}`);
}

run().catch((error) => {
  console.error('audit:report failed', error);
  process.exit(1);
});
