export type CaptureMode = 'baseline' | 'motion' | 'both';

export interface CompetitorSite {
  id: string;
  baseUrl: string;
}

export interface AuditConfig {
  runId: string;
  marketingBaseUrl: string;
  platformBaseUrl: string;
  competitors: CompetitorSite[];
  captureMode: CaptureMode;
  maxRoutes: number;
  maxDepth: number;
  rateLimitMs: number;
  headless: boolean;
  allowDestructive: boolean;
  allowWrites: boolean;
  blockTrackers: boolean;
  deviceScaleFactor: number;
}

const DEFAULTS = {
  marketingBaseUrl: 'https://aha.inc',
  platformBaseUrl: 'https://platform.aha.inc',
  competitors: [
    { id: 'tks', baseUrl: 'https://www.tks.world' },
    { id: 'refunnel', baseUrl: 'https://refunnel.com' },
  ],
  captureMode: 'both' as CaptureMode,
  maxRoutes: 200,
  maxDepth: 4,
  rateLimitMs: 350,
  headless: false,
  allowDestructive: false,
  allowWrites: true,
  blockTrackers: true,
  deviceScaleFactor: 2,
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatRunId(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function parseCompetitors(value?: string): CompetitorSite[] {
  if (!value) return DEFAULTS.competitors;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULTS.competitors;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') {
            const [id, baseUrl] = item.split('=');
            if (!id || !baseUrl) return null;
            return { id: id.trim(), baseUrl: baseUrl.trim() };
          }
          if (item && typeof item === 'object') {
            const id = String(item.id || '').trim();
            const baseUrl = String(item.baseUrl || '').trim();
            if (!id || !baseUrl) return null;
            return { id, baseUrl };
          }
          return null;
        })
        .filter(Boolean) as CompetitorSite[];
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([id, baseUrl]) => ({
        id: String(id).trim(),
        baseUrl: String(baseUrl).trim(),
      }));
    }
  } catch {
    // fall through to parse as comma-separated list
  }

  return trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, baseUrl] = entry.split('=');
      return { id: (id || '').trim(), baseUrl: (baseUrl || '').trim() };
    })
    .filter((site) => site.id && site.baseUrl);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuditConfig {
  return {
    runId: env.RUN_ID?.trim() || formatRunId(),
    marketingBaseUrl: env.AHA_MARKETING_BASE_URL?.trim() || DEFAULTS.marketingBaseUrl,
    platformBaseUrl: env.AHA_PLATFORM_BASE_URL?.trim() || DEFAULTS.platformBaseUrl,
    competitors: parseCompetitors(env.COMPETITOR_SITES),
    captureMode: (env.CAPTURE_MODE as CaptureMode) || DEFAULTS.captureMode,
    maxRoutes: parseNumber(env.MAX_ROUTES, DEFAULTS.maxRoutes),
    maxDepth: parseNumber(env.MAX_DEPTH, DEFAULTS.maxDepth),
    rateLimitMs: parseNumber(env.RATE_LIMIT_MS, DEFAULTS.rateLimitMs),
    headless: parseBoolean(env.HEADLESS, DEFAULTS.headless),
    allowDestructive: parseBoolean(env.ALLOW_DESTRUCTIVE, DEFAULTS.allowDestructive),
    allowWrites: parseBoolean(env.ALLOW_WRITES, DEFAULTS.allowWrites),
    blockTrackers: parseBoolean(env.BLOCK_TRACKERS, DEFAULTS.blockTrackers),
    deviceScaleFactor: parseNumber(env.DEVICE_SCALE_FACTOR, DEFAULTS.deviceScaleFactor),
  };
}

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};
