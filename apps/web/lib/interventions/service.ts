import { prisma } from "@/lib/prisma";

export type InterventionFilters = {
  status?: string;
  type?: string;
  priority?: string;
};

/**
 * List interventions for a brand with optional filters.
 */
export async function listInterventions(
  brandId: string,
  filters: InterventionFilters = {}
) {
  const where: Record<string, unknown> = { brandId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }

  return prisma.interventionCase.findMany({
    where,
    orderBy: [
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });
}

/**
 * Resolve an intervention with a resolution note.
 */
export async function resolveIntervention(
  id: string,
  resolution: string,
  resolvedBy?: string
) {
  return prisma.interventionCase.update({
    where: { id },
    data: {
      status: "resolved",
      resolution,
      resolvedAt: new Date(),
      resolvedBy,
    },
  });
}

/**
 * Create a new intervention case.
 */
export async function createIntervention(payload: {
  type: string;
  title: string;
  description?: string;
  priority?: string;
  brandId: string;
  campaignCreatorId?: string;
}) {
  return prisma.interventionCase.create({
    data: {
      type: payload.type,
      status: "open",
      priority: payload.priority || "normal",
      title: payload.title,
      description: payload.description,
      brandId: payload.brandId,
      campaignCreatorId: payload.campaignCreatorId,
    },
  });
}
