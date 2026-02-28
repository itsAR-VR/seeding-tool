import { readFile, writeFile } from 'fs/promises';
import type { Page, Response } from 'playwright';
import { writeText } from '../utils/fs.js';

export interface RequestLogEntry {
  url: string;
  method: string;
  status: number;
  resourceType: string;
  startTime: number;
  endTime: number;
}

export interface RequestLogger {
  entries: RequestLogEntry[];
  flush: (outputPath: string) => Promise<void>;
  stop: () => void;
}

export function attachRequestLogger(page: Page): RequestLogger {
  const entries: RequestLogEntry[] = [];

  const handler = async (response: Response) => {
    const request = response.request();
    const timing = request.timing();
    entries.push({
      url: response.url(),
      method: request.method(),
      status: response.status(),
      resourceType: request.resourceType(),
      startTime: timing.startTime,
      endTime: timing.responseEnd,
    });
  };

  page.on('response', handler);

  return {
    entries,
    flush: async (outputPath: string) => {
      const lines = entries.map((entry) => JSON.stringify(entry)).join('\n');
      await writeText(outputPath, lines);
    },
    stop: () => {
      page.off('response', handler);
    },
  };
}

function scrubHeaders(headers: { name: string; value: string }[]): void {
  for (const header of headers) {
    const name = header.name.toLowerCase();
    if (name === 'authorization' || name === 'cookie' || name === 'set-cookie') {
      header.value = '[REDACTED]';
    }
  }
}

export async function scrubHar(inputPath: string, outputPath: string): Promise<void> {
  const raw = await readFile(inputPath, 'utf-8');
  const har = JSON.parse(raw);
  const entries = har?.log?.entries ?? [];

  for (const entry of entries) {
    if (entry.request?.headers) scrubHeaders(entry.request.headers);
    if (entry.response?.headers) scrubHeaders(entry.response.headers);
  }

  await writeFile(outputPath, JSON.stringify(har, null, 2));
}
