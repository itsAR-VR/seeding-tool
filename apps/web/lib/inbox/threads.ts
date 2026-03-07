import { prisma } from "@/lib/prisma";

export type ThreadFilter = {
  status?: string;
  hasUnreviewedDraft?: boolean;
  hasAddressSnapshot?: boolean;
};

/**
 * List conversation threads for a brand with optional filters.
 */
export async function listThreads(brandId: string, filters?: ThreadFilter) {
  const where: Record<string, unknown> = { brandId };

  if (filters?.status) {
    where.status = filters.status;
  }

  const threads = await prisma.conversationThread.findMany({
    where,
    include: {
      campaignCreator: {
        include: {
          creator: {
            include: { profiles: true },
          },
          campaign: { select: { id: true, name: true } },
          aiDrafts: {
            where: { status: "draft" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          shippingSnapshots: {
            where: { isActive: false, confirmedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Apply post-query filters
  let result = threads;

  if (filters?.hasUnreviewedDraft) {
    result = result.filter(
      (t) => t.campaignCreator.aiDrafts.length > 0
    );
  }

  if (filters?.hasAddressSnapshot) {
    result = result.filter(
      (t) => t.campaignCreator.shippingSnapshots.length > 0
    );
  }

  return result;
}

/**
 * Resolve a thread by ID, ensuring it belongs to the specified brand.
 */
export async function resolveThread(threadId: string, brandId: string) {
  return prisma.conversationThread.findFirst({
    where: { id: threadId, brandId },
    include: {
      campaignCreator: {
        include: {
          creator: { include: { profiles: true } },
          campaign: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/**
 * Get a thread with its full message history.
 */
export async function getThreadWithMessages(threadId: string, brandId: string) {
  return prisma.conversationThread.findFirst({
    where: { id: threadId, brandId },
    include: {
      campaignCreator: {
        include: {
          creator: { include: { profiles: true } },
          campaign: { select: { id: true, name: true } },
          aiDrafts: {
            orderBy: { createdAt: "desc" },
          },
          shippingSnapshots: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
      aiArtifacts: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * Get or create a conversation thread for a campaign creator.
 */
export async function getOrCreateThread(
  campaignCreatorId: string,
  brandId: string,
  externalThreadId?: string,
  subject?: string
) {
  const existing = await prisma.conversationThread.findUnique({
    where: { campaignCreatorId },
  });

  if (existing) {
    // Update external thread ID if newly available
    if (externalThreadId && !existing.externalThreadId) {
      return prisma.conversationThread.update({
        where: { id: existing.id },
        data: { externalThreadId },
      });
    }
    return existing;
  }

  return prisma.conversationThread.create({
    data: {
      campaignCreatorId,
      brandId,
      externalThreadId,
      subject,
      status: "open",
    },
  });
}
