import type { Page, Response } from 'playwright';

export interface CssCollector {
  cssTexts: string[];
  stop: () => void;
}

export function attachCssCollector(page: Page): CssCollector {
  const cssTexts: string[] = [];

  const handler = async (response: Response) => {
    try {
      const url = response.url();
      const headers = await response.allHeaders();
      const contentType = headers['content-type'] || '';
      if (!contentType.includes('text/css') && !url.endsWith('.css')) return;
      const text = await response.text();
      cssTexts.push(text);
    } catch {
      // ignore css extraction failures
    }
  };

  page.on('response', handler);

  return {
    cssTexts,
    stop: () => page.off('response', handler),
  };
}
