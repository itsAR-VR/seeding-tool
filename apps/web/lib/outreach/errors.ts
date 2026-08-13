/**
 * Custom errors for the outreach send pipeline.
 */

/**
 * Thrown when an email alias has reached its daily send limit.
 */
export class DailyLimitExceededError extends Error {
  readonly code = "DAILY_LIMIT_EXCEEDED";

  constructor(
    public readonly aliasId: string,
    public readonly sent: number,
    public readonly dailyLimit: number
  ) {
    super(`Daily send limit (${dailyLimit}) reached for alias ${aliasId}`);
    this.name = "DailyLimitExceededError";
  }
}

/**
 * Thrown when an alias is paused and cannot send.
 */
export class AliasPausedError extends Error {
  readonly code = "ALIAS_PAUSED";

  constructor(public readonly aliasId: string) {
    super(`Email alias ${aliasId} is paused`);
    this.name = "AliasPausedError";
  }
}

/**
 * Thrown when aliasId belongs to a different brand than the sender's membership.
 */
export class CrossBrandAliasError extends Error {
  readonly code = "CROSS_BRAND_ALIAS";

  constructor(
    public readonly aliasId: string,
    public readonly aliasBrandId: string,
    public readonly memberBrandId: string
  ) {
    super(
      `Alias ${aliasId} belongs to brand ${aliasBrandId}, not ${memberBrandId}`
    );
    this.name = "CrossBrandAliasError";
  }
}
