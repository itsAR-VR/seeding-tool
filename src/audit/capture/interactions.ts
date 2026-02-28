import type { Page } from 'playwright';
import { sleep } from '../utils/time.js';

export async function runGenericInteractions(page: Page): Promise<void> {
  const hoverSelectors = [
    'nav a',
    'nav button',
    '[role="navigation"] a',
    '[role="navigation"] button',
    'button',
    'a',
  ];

  for (const selector of hoverSelectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    if (count === 0) continue;
    for (let i = 0; i < Math.min(count, 4); i += 1) {
      try {
        await locator.nth(i).hover({ timeout: 2000 });
        await sleep(150);
      } catch {
        // ignore hover failures
      }
    }
    break;
  }

  const expandable = page.locator('[aria-expanded="false"]');
  const count = await expandable.count();
  for (let i = 0; i < Math.min(count, 3); i += 1) {
    const el = expandable.nth(i);
    try {
      await el.click({ timeout: 2000 });
      await sleep(200);
      await el.click({ timeout: 2000 });
      await sleep(200);
    } catch {
      // ignore
    }
  }

  const scrollHeights = await page.evaluate(() => document.body.scrollHeight);
  const viewport = page.viewportSize();
  const viewportHeight = viewport?.height ?? 800;
  const steps = Math.max(1, Math.floor(scrollHeights / viewportHeight));
  for (let i = 1; i <= Math.min(steps, 5); i += 1) {
    await page.evaluate((y) => window.scrollTo(0, y), i * viewportHeight);
    await sleep(200);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(150);
}
