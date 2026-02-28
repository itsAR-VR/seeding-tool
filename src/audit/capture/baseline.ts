import path from 'path';
import type { Page } from 'playwright';
import { writeJson, writeText, ensureDir } from '../utils/fs.js';
import { ensureNameHelper, scrollPage, waitForNetworkIdle } from '../utils/page.js';

export interface BaselineCaptureOptions {
  outDir: string;
  viewportName: string;
}

export interface BaselineCaptureResult {
  viewport: string;
  screenshotFull: string;
  screenshotAboveFold: string;
  domSnapshot: string;
  accessibilitySnapshot: string;
}

export async function captureBaseline(page: Page, options: BaselineCaptureOptions): Promise<BaselineCaptureResult> {
  await ensureNameHelper(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  await waitForNetworkIdle(page, 5000);
  await scrollPage(page);

  const screenshotsDir = path.join(options.outDir, 'screenshots');
  await ensureDir(screenshotsDir);

  const screenshotFull = path.join(screenshotsDir, `${options.viewportName}-full.png`);
  const screenshotAboveFold = path.join(screenshotsDir, `${options.viewportName}-above-fold.png`);
  const domSnapshot = path.join(options.outDir, `dom-${options.viewportName}.html`);
  const accessibilitySnapshot = path.join(options.outDir, `a11y-${options.viewportName}.json`);

  await page.screenshot({ path: screenshotFull, fullPage: true });
  await page.screenshot({ path: screenshotAboveFold, fullPage: false });

  const dom = await page.content();
  await writeText(domSnapshot, dom);

  const a11y = await (page as any).accessibility?.snapshot?.();
  await writeJson(accessibilitySnapshot, a11y ?? {});

  return {
    viewport: options.viewportName,
    screenshotFull,
    screenshotAboveFold,
    domSnapshot,
    accessibilitySnapshot,
  };
}
