import path from 'path';
import type { Page } from 'playwright';
import { writeJson, ensureDir } from '../utils/fs.js';
import { runGenericInteractions } from './interactions.js';
import { sleep } from '../utils/time.js';
import { ensureNameHelper } from '../utils/page.js';

export interface MotionCaptureOptions {
  outDir: string;
  viewportName: string;
}

export interface MotionCaptureResult {
  viewport: string;
  motionLog: string;
  mutationLog: string;
  animationSnapshots: string;
  screenshots: string[];
}

async function installMotionListeners(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__pwMotionEvents = [];
    (window as any).__pwMutationEvents = [];
    (window as any).__pwAnimationSnapshots = { before: [], after: [] };

    const pushEvent = (type: string, event: any) => {
      (window as any).__pwMotionEvents.push({
        type,
        timestamp: Date.now(),
        target: event?.target?.tagName,
        id: event?.target?.id,
        className: event?.target?.className,
      });
    };

    ['animationstart', 'animationend', 'transitionrun', 'transitionend'].forEach((type) => {
      document.addEventListener(type, (event) => pushEvent(type, event), true);
    });

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target as HTMLElement;
        (window as any).__pwMutationEvents.push({
          timestamp: Date.now(),
          type: mutation.type,
          tagName: target?.tagName,
          id: target?.id,
          className: target?.className,
        });
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-expanded', 'data-state'],
      subtree: true,
    });
  });
}

async function snapshotAnimations(page: Page, key: 'before' | 'after'): Promise<void> {
  await page.evaluate((snapshotKey) => {
    const animations = document.getAnimations();
    (window as any).__pwAnimationSnapshots[snapshotKey] = animations.map((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target as HTMLElement | null;
      return {
        name: (animation as any).animationName || animation.id,
        playState: animation.playState,
        duration: animation.effect ? (animation.effect as any).getTiming?.().duration : undefined,
        target: target?.tagName,
        id: target?.id,
        className: target?.className,
      };
    });
  }, key);
}

export async function captureMotion(page: Page, options: MotionCaptureOptions): Promise<MotionCaptureResult> {
  await ensureNameHelper(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installMotionListeners(page);

  const screenshotsDir = path.join(options.outDir, 'screenshots');
  await ensureDir(screenshotsDir);

  const startShot = path.join(screenshotsDir, `${options.viewportName}-motion-start.png`);
  const endShot = path.join(screenshotsDir, `${options.viewportName}-motion-end.png`);

  await snapshotAnimations(page, 'before');
  await page.screenshot({ path: startShot, fullPage: false });
  await runGenericInteractions(page);
  await sleep(300);
  await snapshotAnimations(page, 'after');
  await page.screenshot({ path: endShot, fullPage: false });

  const motionEvents = await page.evaluate(() => (window as any).__pwMotionEvents ?? []);
  const mutationEvents = await page.evaluate(() => (window as any).__pwMutationEvents ?? []);
  const animationSnapshots = await page.evaluate(() => (window as any).__pwAnimationSnapshots ?? {});

  const motionLog = path.join(options.outDir, `motion-events-${options.viewportName}.json`);
  const mutationLog = path.join(options.outDir, `motion-mutations-${options.viewportName}.json`);
  const animationSnapshotsPath = path.join(options.outDir, `motion-animations-${options.viewportName}.json`);

  await writeJson(motionLog, motionEvents);
  await writeJson(mutationLog, mutationEvents);
  await writeJson(animationSnapshotsPath, animationSnapshots);

  return {
    viewport: options.viewportName,
    motionLog,
    mutationLog,
    animationSnapshots: animationSnapshotsPath,
    screenshots: [startShot, endShot],
  };
}
