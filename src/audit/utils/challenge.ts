import type { Page, Response } from 'playwright';

const CHALLENGE_SELECTORS = [
  '#challenge-running',
  '.cf-turnstile',
  '#cf-please-wait',
  '[data-cf-turnstile]',
];

const CHALLENGE_TITLES = ['just a moment', 'attention required'];

export async function detectChallenge(page: Page, response?: Response | null): Promise<boolean> {
  try {
    const title = await page.title();
    if (CHALLENGE_TITLES.some((needle) => title.toLowerCase().includes(needle))) {
      return true;
    }
  } catch {
    // ignore title errors
  }

  try {
    for (const selector of CHALLENGE_SELECTORS) {
      if (await page.locator(selector).first().isVisible()) {
        return true;
      }
    }
  } catch {
    // ignore selector errors
  }

  if (response) {
    try {
      const headers = await response.allHeaders();
      if (response.status() === 403 && headers['cf-ray']) return true;
    } catch {
      // ignore headers
    }
  }

  return false;
}
