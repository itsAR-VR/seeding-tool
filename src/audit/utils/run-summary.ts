import path from 'path';
import { writeJson } from './fs.js';
import { readFile } from 'fs/promises';
import { nowIso } from './time.js';
import type { AuditConfig } from '../config.js';

export interface RunSummary {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  targets: Record<string, string | string[]>;
  outputs: string[];
}

export function createRunSummary(config: AuditConfig): RunSummary {
  return {
    runId: config.runId,
    startedAt: nowIso(),
    targets: {
      marketingBaseUrl: config.marketingBaseUrl,
      platformBaseUrl: config.platformBaseUrl,
      competitors: config.competitors.map((site) => site.baseUrl),
    },
    outputs: [],
  };
}

export async function writeRunSummary(runId: string, summary: RunSummary): Promise<void> {
  const outputPath = path.join('artifacts', runId, 'run-summary.json');
  let existing: RunSummary | null = null;
  try {
    const raw = await readFile(outputPath, 'utf-8');
    existing = JSON.parse(raw) as RunSummary;
  } catch {
    existing = null;
  }

  if (existing) {
    const mergedOutputs = Array.from(new Set([...(existing.outputs || []), ...(summary.outputs || [])]));
    await writeJson(outputPath, {
      ...existing,
      ...summary,
      outputs: mergedOutputs,
      startedAt: existing.startedAt || summary.startedAt,
    });
    return;
  }

  await writeJson(outputPath, summary);
}
