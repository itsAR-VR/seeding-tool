import { prisma } from "@/lib/prisma";

/** Brands with a live connection to this provider. */
export async function brandsConnectedTo(provider: string): Promise<string[]> {
  const connections = await prisma.brandConnection.findMany({
    where: { provider, status: "connected" },
    select: { brandId: true },
    distinct: ["brandId"],
  });
  return connections.map((c) => c.brandId);
}
