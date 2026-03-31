import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 20;
const SENSITIVE_KEYS = new Set([
  "body",
  "html",
  "bodyHtml",
  "rawHtml",
  "email",
  "emails",
  "contactValue",
  "phone",
  "phones",
  "token",
  "authorization",
]);

function normalizeScalar(value: unknown): Prisma.InputJsonValue | undefined {
  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value as Prisma.InputJsonValue;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }

  return undefined;
}

function scrubKeyValue(key: string, value: unknown): Prisma.InputJsonValue {
  if (SENSITIVE_KEYS.has(key)) {
    return "[redacted]";
  }

  const scalar = normalizeScalar(value);
  if (scalar !== undefined) {
    return scalar;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => {
      const nestedScalar = normalizeScalar(item);
      return nestedScalar !== undefined ? nestedScalar : "[truncated]";
    }) as Prisma.InputJsonValue;
  }

  if (value && typeof value === "object") {
    return normalizePayloadForRetention(value as Record<string, unknown>);
  }

  return "[unsupported]";
}

export function normalizePayloadForRetention(
  payload: Record<string, unknown>
): Prisma.InputJsonValue {
  return Object.fromEntries(
    Object.entries(payload).slice(0, 50).map(([key, value]) => [
      key,
      scrubKeyValue(key, value),
    ])
  ) as Prisma.InputJsonValue;
}

export function hashPayload(payload: Prisma.InputJsonValue) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function recordCreatorRawPayload(input: {
  creatorId?: string | null;
  searchJobId?: string | null;
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const normalizedPayload = normalizePayloadForRetention(input.payload);
  const payloadHash = hashPayload(normalizedPayload);

  return prisma.creatorRawPayload.create({
    data: {
      creatorId: input.creatorId ?? null,
      searchJobId: input.searchJobId ?? null,
      source: input.source,
      eventType: input.eventType,
      payload: normalizedPayload,
      payloadHash,
    },
  });
}
