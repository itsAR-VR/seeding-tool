import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UnifiedDiscoverySource } from "@/lib/creator-search/contracts";

export type CreatorDiscoveryTouchInput = {
  creatorId: string;
  source: UnifiedDiscoverySource | string;
  searchJobId?: string | null;
  externalId?: string | null;
  rawSourceCategory?: string | null;
  canonicalCategory?: string | null;
  email?: string | null;
  seedCreatorId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function recordCreatorDiscoveryTouch(
  input: CreatorDiscoveryTouchInput
) {
  return prisma.creatorDiscoveryTouch.create({
    data: {
      creatorId: input.creatorId,
      source: input.source,
      searchJobId: input.searchJobId ?? null,
      externalId: input.externalId ?? null,
      rawSourceCategory: input.rawSourceCategory ?? null,
      canonicalCategory: input.canonicalCategory ?? null,
      email: input.email ?? null,
      seedCreatorId: input.seedCreatorId ?? null,
      metadata: input.metadata,
    },
  });
}
