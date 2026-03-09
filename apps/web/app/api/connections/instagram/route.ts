import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

class ResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function getCurrentBrandId() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new ResponseError("Unauthorized", 401);
  }

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) {
    throw new ResponseError("User not found", 404);
  }

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new ResponseError("No brand found", 404);
  }

  return membership.brandId;
}

/**
 * GET /api/connections/instagram
 * Returns the Instagram connection status for the current brand.
 */
export async function GET() {
  try {
    const brandId = await getCurrentBrandId();

    const [credential, connection] = await Promise.all([
      prisma.providerCredential.findFirst({
        where: {
          brandId,
          provider: "instagram",
          isValid: true,
        },
      }),
      prisma.brandConnection.findFirst({
        where: {
          brandId,
          provider: "instagram",
        },
      }),
    ]);

    return NextResponse.json({
      connected: Boolean(credential && connection?.status === "connected"),
      username: connection?.externalId ?? credential?.label ?? undefined,
      status: connection?.status ?? "disconnected",
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("[connections/instagram/GET]", error);
    return NextResponse.json(
      { error: "Failed to load Instagram connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/instagram
 * Disconnect Instagram for the current brand.
 */
export async function DELETE() {
  try {
    const brandId = await getCurrentBrandId();

    await prisma.$transaction(async (tx) => {
      await tx.providerCredential.updateMany({
        where: {
          brandId,
          provider: "instagram",
        },
        data: {
          isValid: false,
        },
      });

      await tx.brandConnection.deleteMany({
        where: {
          brandId,
          provider: "instagram",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("[connections/instagram/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect Instagram" },
      { status: 500 }
    );
  }
}
