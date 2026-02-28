import path from 'path';
import { readFile } from 'fs/promises';
import { ensureDir, writeText } from '../utils/fs.js';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function summarizeFonts(tokens: any): string {
  if (!tokens?.fonts?.length) return 'n/a';
  return tokens.fonts.slice(0, 8).join(', ');
}

function summarizeColors(tokens: any): string {
  if (!tokens?.colors?.length) return 'n/a';
  return tokens.colors.slice(0, 8).map((c: any) => c.value).join(', ');
}

function summarizeKeyframes(animations: any): string {
  if (!animations?.keyframes?.length) return 'n/a';
  return animations.keyframes.slice(0, 12).join(', ');
}

export async function writeBlueprints(runId: string): Promise<void> {
  const ownedDir = path.join('docs', 'audit', 'blueprints', 'owned');
  const fusionDir = path.join('docs', 'audit', 'blueprints', 'fusion');
  await ensureDir(ownedDir);
  await ensureDir(fusionDir);

  const marketingTokens = await readJson<any>(path.join('artifacts', runId, 'marketing', 'tokens.json'));
  const marketingAnimations = await readJson<any>(path.join('artifacts', runId, 'marketing', 'animations.json'));

  const ownedBlueprint = `# Owned Rebuild Blueprint\n\n` +
    `## Tokens (from artifacts/${runId}/marketing/tokens.json)\n` +
    `- Fonts: ${summarizeFonts(marketingTokens)}\n` +
    `- Colors: ${summarizeColors(marketingTokens)}\n\n` +
    `## Motion (from artifacts/${runId}/marketing/animations.json)\n` +
    `- Keyframes: ${summarizeKeyframes(marketingAnimations)}\n\n` +
    `## Component Map (TODO)\n` +
    `- Fill after first audit run; map sections to React/Tailwind components.\n`;

  await writeText(path.join(ownedDir, 'rebuild-blueprint.md'), ownedBlueprint);

  const parityTests = `# Parity Test Plan\n\n` +
    `- Smoke navigation for marketing + platform routes\n` +
    `- Interaction tests for primary CTAs and hover states\n` +
    `- Onboarding replay test (manual bootstrap)\n`;
  await writeText(path.join(ownedDir, 'parity-tests.md'), parityTests);

  const competitorsTokensTks = await readJson<any>(path.join('artifacts', runId, 'competitors', 'tks', 'typography.json'));
  const competitorsTokensRefunnel = await readJson<any>(path.join('artifacts', runId, 'competitors', 'refunnel', 'typography.json'));
  const competitorsMotionTks = await readJson<any>(path.join('artifacts', runId, 'competitors', 'tks', 'motion.json'));
  const competitorsMotionRefunnel = await readJson<any>(path.join('artifacts', runId, 'competitors', 'refunnel', 'motion.json'));

  const fusionTypography = `# Fusion Typography\n\n` +
    `## TKS (sample)\n` +
    `- Fonts: ${summarizeFonts(competitorsTokensTks)}\n` +
    `- Colors: ${summarizeColors(competitorsTokensTks)}\n\n` +
    `## Refunnel (sample)\n` +
    `- Fonts: ${summarizeFonts(competitorsTokensRefunnel)}\n` +
    `- Colors: ${summarizeColors(competitorsTokensRefunnel)}\n`;
  await writeText(path.join(fusionDir, 'typography.md'), fusionTypography);

  const fusionMotion = `# Fusion Motion\n\n` +
    `## TKS Keyframes\n` +
    `- ${summarizeKeyframes(competitorsMotionTks)}\n\n` +
    `## Refunnel Keyframes\n` +
    `- ${summarizeKeyframes(competitorsMotionRefunnel)}\n`;
  await writeText(path.join(fusionDir, 'motion.md'), fusionMotion);

  const componentCatalog = `# Component Catalog\n\n` +
    `- Hero variants\n- Feature grids\n- FAQ accordion\n- Testimonial/case modules\n- CTA blocks\n`;
  await writeText(path.join(fusionDir, 'components.md'), componentCatalog);

  const fusionBlueprint = `# Fusion Blueprint\n\n` +
    `## IA (TKS-like funnel)\n` +
    `- Home, Program, Admissions, Outcomes, FAQ, Contact\n\n` +
    `## Visual + Motion Guidance\n` +
    `- Use Refunnel-level polish with TKS-style micro-animations\n`;
  await writeText(path.join(fusionDir, 'blueprint.md'), fusionBlueprint);

  const backlog = `# Implementation Backlog\n\n` +
    `1. Foundation (layout + typography tokens)\n` +
    `2. Core pages (home + program + admissions)\n` +
    `3. Motion polish + interaction parity\n` +
    `4. Playwright parity tests\n`;
  await writeText(path.join(fusionDir, 'backlog.md'), backlog);
}
