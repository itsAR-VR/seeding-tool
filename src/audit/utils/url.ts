const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

export function toAbsoluteUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
  url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url.toString();
}

export function routeKeyFromUrl(input: string): string {
  const url = new URL(input);
  if (url.pathname === '/' || url.pathname === '') return 'home';
  return url.pathname
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '__');
}
