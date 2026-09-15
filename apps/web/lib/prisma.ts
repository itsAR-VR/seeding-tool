import { Pool, type PoolConfig } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool(createPgPoolConfig(connectionString));
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error"]
        : ["error"],
  });
}

export function createPgPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString: normalizeRequiredSslModeForPg(connectionString),
  };
}

function normalizeRequiredSslModeForPg(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.searchParams.get("sslmode") !== "require") {
      return connectionString;
    }

    // Supabase pooler URLs commonly use sslmode=require. In current
    // node-postgres, that verifies the full certificate chain and can reject
    // Supabase's pooler chain in serverless runtimes. sslmode=no-verify keeps
    // TLS encrypted while making the behavior explicit for pg.
    url.searchParams.set("sslmode", "no-verify");
    return url.toString();
  } catch {
    return connectionString;
  }
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
