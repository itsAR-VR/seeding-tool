/**
 * Email warmup logic — gradual send volume ramp for new/cold aliases.
 *
 * Schedule: 5/day (days 1-3) -> 15/day (days 4-7) -> 30/day (days 8-14) -> full limit
 *
 * Pure functions, no side effects. Warmup day is computed from date math
 * (no stored counter, no cron race condition, no day-0 ambiguity).
 */

const MS_PER_DAY = 86_400_000;

type WarmupAlias = {
  readonly isWarmedUp: boolean;
  readonly warmupStartedAt: Date | null;
  readonly dailyLimit: number;
};

/**
 * Return the effective daily send limit for an alias, accounting for warmup.
 *
 * - Warmed aliases get their full dailyLimit.
 * - Aliases without a warmupStartedAt date get 0 (cannot send).
 * - Otherwise, the limit ramps up over 14 days.
 */
export function getEffectiveDailyLimit(alias: WarmupAlias): number {
  if (alias.isWarmedUp) return alias.dailyLimit;
  if (!alias.warmupStartedAt) return 0;

  const daysSinceStart =
    Math.floor((Date.now() - alias.warmupStartedAt.getTime()) / MS_PER_DAY) + 1;

  if (daysSinceStart <= 3) return 5;
  if (daysSinceStart <= 7) return 15;
  if (daysSinceStart <= 14) return 30;

  return alias.dailyLimit;
}

/**
 * Check whether an alias has completed its 14-day warmup period.
 */
export function isWarmupComplete(alias: {
  readonly warmupStartedAt: Date | null;
}): boolean {
  if (!alias.warmupStartedAt) return false;

  const days =
    Math.floor((Date.now() - alias.warmupStartedAt.getTime()) / MS_PER_DAY) + 1;

  return days > 14;
}
