export interface AnimationInventory {
  keyframes: string[];
}

export function extractKeyframesFromCss(cssText: string): string[] {
  const names: string[] = [];
  const regex = /@keyframes\s+([a-zA-Z0-9_-]+)/g;
  let match = regex.exec(cssText);
  while (match) {
    if (match[1]) names.push(match[1]);
    match = regex.exec(cssText);
  }
  return names;
}

export function buildAnimationInventory(cssTexts: string[]): AnimationInventory {
  const set = new Set<string>();
  for (const text of cssTexts) {
    for (const name of extractKeyframesFromCss(text)) {
      set.add(name);
    }
  }
  return { keyframes: Array.from(set).sort() };
}
