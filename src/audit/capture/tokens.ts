import type { Page } from 'playwright';
import { ensureNameHelper } from '../utils/page.js';

export interface TypographySample {
  selector: string;
  text: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
}

export interface TokenExtraction {
  fonts: string[];
  typography: TypographySample[];
  colors: { value: string; count: number }[];
  radii: { value: string; count: number }[];
  shadows: { value: string; count: number }[];
}

export async function extractTokens(page: Page): Promise<TokenExtraction> {
  await ensureNameHelper(page);
  return page.evaluate(() => {
    const typography: TypographySample[] = [];
    const sampleNodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,button,[role="button"],a,body'));
    for (const node of sampleNodes.slice(0, 40)) {
      const computed = window.getComputedStyle(node as Element);
      typography.push({
        selector: (node as Element).tagName.toLowerCase(),
        text: (node as HTMLElement).innerText?.trim().slice(0, 120) || '',
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
      });
    }

    const colorCounts = new Map<string, number>();
    const radiusCounts = new Map<string, number>();
    const shadowCounts = new Map<string, number>();

    const elements = Array.from(document.querySelectorAll('*')).slice(0, 600);
    for (const element of elements) {
      const style = window.getComputedStyle(element as Element);
      const color = style.color;
      const bg = style.backgroundColor;
      const border = style.borderColor;
      const radius = style.borderRadius;
      const shadow = style.boxShadow;

      [color, bg, border].forEach((value) => {
        if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
          colorCounts.set(value, (colorCounts.get(value) || 0) + 1);
        }
      });
      if (radius && radius !== '0px') {
        radiusCounts.set(radius, (radiusCounts.get(radius) || 0) + 1);
      }
      if (shadow && shadow !== 'none') {
        shadowCounts.set(shadow, (shadowCounts.get(shadow) || 0) + 1);
      }
    }

    const fonts = Array.from(document.fonts || []).map((font) => font.family);

    const toSortedArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count }));

    return {
      fonts: Array.from(new Set(fonts)).filter(Boolean),
      typography,
      colors: toSortedArray(colorCounts),
      radii: toSortedArray(radiusCounts),
      shadows: toSortedArray(shadowCounts),
    } as TokenExtraction;
  });
}
