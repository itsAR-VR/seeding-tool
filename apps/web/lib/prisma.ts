type PrismaClientPlaceholder = null;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientPlaceholder;
};

export const prisma = globalForPrisma.prisma ?? null;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
