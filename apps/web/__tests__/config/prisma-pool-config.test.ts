import { describe, expect, it, vi } from "vitest";
import { parse } from "pg-connection-string";

import { createPgPoolConfig } from "@/lib/prisma";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL =
    "postgres://user:password@db.example.test:6543/postgres";

  return {
    pool: vi.fn(),
    prismaClient: vi.fn(),
    prismaPg: vi.fn(),
  };
});

vi.mock("pg", () => ({
  Pool: mocks.pool,
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: mocks.prismaClient,
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: mocks.prismaPg,
}));

describe("createPgPoolConfig", () => {
  it("normalizes sslmode=require to pg no-verify TLS behavior", () => {
    const config = createPgPoolConfig(
      "postgres://user:password@db.example.test:6543/postgres?sslmode=require&pgbouncer=true"
    );

    expect(config.connectionString).toBe(
      "postgres://user:password@db.example.test:6543/postgres?sslmode=no-verify&pgbouncer=true"
    );
    expect(parse(config.connectionString!).ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("leaves verify-full URLs unchanged", () => {
    const connectionString =
      "postgres://user:password@db.example.test:6543/postgres?sslmode=verify-full";

    expect(createPgPoolConfig(connectionString).connectionString).toBe(
      connectionString
    );
  });

  it("leaves URLs without sslmode unchanged", () => {
    const connectionString =
      "postgres://user:password@db.example.test:6543/postgres";

    expect(createPgPoolConfig(connectionString).connectionString).toBe(
      connectionString
    );
  });

  it("leaves already normalized no-verify URLs unchanged", () => {
    const connectionString =
      "postgres://user:password@db.example.test:6543/postgres?sslmode=no-verify";

    expect(createPgPoolConfig(connectionString).connectionString).toBe(
      connectionString
    );
  });

  it("leaves invalid connection strings unchanged", () => {
    const connectionString = "not a url";

    expect(createPgPoolConfig(connectionString).connectionString).toBe(
      connectionString
    );
  });
});
