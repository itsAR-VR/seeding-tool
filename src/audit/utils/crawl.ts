import type { Page } from 'playwright';
import { normalizeUrl, toAbsoluteUrl } from './url.js';
import { sleep } from './time.js';
import { ensureNameHelper } from './page.js';

export interface CrawlOptions {
  baseUrl: string;
  maxDepth: number;
  maxRoutes: number;
  rateLimitMs: number;
}

export async function crawlSite(page: Page, options: CrawlOptions): Promise<string[]> {
  await ensureNameHelper(page);
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: options.baseUrl, depth: 0 }];
  const results: string[] = [];

  while (queue.length && results.length < options.maxRoutes) {
    const next = queue.shift();
    if (!next) break;

    const normalized = normalizeUrl(next.url);
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    try {
      await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 20000 });
      results.push(normalized);
      const links: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map((anchor) => (anchor as HTMLAnchorElement).href),
      );

      if (next.depth < options.maxDepth) {
        for (const href of links) {
          const absolute = toAbsoluteUrl(options.baseUrl, href);
          if (!absolute) continue;
          const candidate = normalizeUrl(absolute);
          if (!candidate.startsWith(options.baseUrl)) continue;
          if (!visited.has(candidate)) {
            queue.push({ url: candidate, depth: next.depth + 1 });
          }
        }
      }
    } catch {
      // ignore crawl errors
    }

    await sleep(options.rateLimitMs);
  }

  return results;
}
