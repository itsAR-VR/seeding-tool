import type { Page } from 'playwright';
import { sleep } from './time.js';

export async function ensureNameHelper(page: Page): Promise<void> {
  await page.evaluate('window.__name = window.__name || function(target, name){ return target; }');
}

export async function waitForNetworkIdle(page: Page, timeoutMs = 5000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs });
  } catch {
    // ignore network idle timeouts
  }
}

export async function scrollPage(page: Page): Promise<void> {
  await ensureNameHelper(page);
  await page.evaluate(async () => {
    const totalHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    const steps = Math.max(1, Math.floor(totalHeight / viewportHeight));
    for (let i = 0; i <= steps; i += 1) {
      window.scrollTo(0, Math.min(totalHeight, i * viewportHeight));
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    window.scrollTo(0, 0);
  });
  await sleep(250);
}
