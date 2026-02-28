export async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const response = await fetch(robotsUrl);
    if (!response.ok) return [];
    const text = await response.text();
    const lines = text.split('\n');
    const sitemapLines = lines
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().startsWith('sitemap:'))
      .map((line) => line.split(/\s+/).slice(1).join(' '))
      .filter(Boolean) as string[];
    return sitemapLines.length ? sitemapLines : [new URL('/sitemap.xml', baseUrl).toString()];
  } catch {
    return [new URL('/sitemap.xml', baseUrl).toString()];
  }
}

export async function fetchSitemapUrlsFromXml(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl);
    if (!response.ok) return [];
    const xml = await response.text();
    const matches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g));
    return matches.map((match) => match[1]).filter(Boolean) as string[];
  } catch {
    return [];
  }
}
