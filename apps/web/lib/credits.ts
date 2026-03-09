/**
 * Credit helpers for Seed Scale.
 *
 * Uses existing schema primitives:
 *   brand_credit_balances   — per-brand credits available
 *   brand_credit_transactions — immutable ledger (type: "mint" | "debit")
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CREDIT_COSTS = {
  creator_search: 5,
  collabstr_search: 1,
  ai_fit_score: 1,
  enrichment: 2,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export class CreditInsufficientError extends Error {
  readonly code = "CREDIT_INSUFFICIENT";

  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = "CreditInsufficientError";
  }
}

function toJsonValue(
  metadata?: Record<string, unknown>
): Prisma.InputJsonValue | undefined {
  if (!metadata) return undefined;
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

export async function getBalance(brandId: string): Promise<number> {
  const row = await prisma.brandCreditBalance.findUnique({
    where: { brandId },
    select: { credits: true },
  });
  return row?.credits ?? 0;
}

export async function ensureCredits(
  brandId: string,
  cost: number
): Promise<void> {
  const available = await getBalance(brandId);
  if (available < cost) {
    throw new CreditInsufficientError(cost, available);
  }
}

export async function mint(
  brandId: string,
  amount: number,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  if (amount <= 0) throw new RangeError("mint amount must be positive");

  return prisma.$transaction(async (tx) => {
    const balance = await tx.brandCreditBalance.upsert({
      where: { brandId },
      create: { brandId, credits: amount },
      update: { credits: { increment: amount } },
      select: { id: true, credits: true },
    });

    await tx.brandCreditTransaction.create({
      data: {
        type: "mint",
        amount,
        reason: reason ?? "Credit grant",
        metadata: toJsonValue(metadata),
        balanceId: balance.id,
      },
    });

    return balance.credits;
  });
}

export async function debit(
  brandId: string,
  amount: number,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  if (amount <= 0) throw new RangeError("debit amount must be positive");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.brandCreditBalance.findUnique({
      where: { brandId },
      select: { id: true, credits: true },
    });

    const current = existing?.credits ?? 0;
    if (current < amount) {
      throw new CreditInsufficientError(amount, current);
    }

    const balance = existing
      ? await tx.brandCreditBalance.update({
          where: { brandId },
          data: { credits: { decrement: amount } },
          select: { id: true, credits: true },
        })
      : null;

    if (!balance) {
      throw new CreditInsufficientError(amount, current);
    }

    await tx.brandCreditTransaction.create({
      data: {
        type: "debit",
        amount: -amount,
        reason: reason ?? "Credit debit",
        metadata: toJsonValue(metadata),
        balanceId: balance.id,
      },
    });

    return balance.credits;
  });
}

export async function debitForOperation(
  brandId: string,
  operation: CreditOperation,
  metadata?: Record<string, unknown>
): Promise<number> {
  return debit(brandId, CREDIT_COSTS[operation], `Consumed for ${operation}`, {
    operation,
    ...metadata,
  });
}
