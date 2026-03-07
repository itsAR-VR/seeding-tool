import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

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

async function getErrorText(response: Response) {
  const text = await response.text();
  return text || response.statusText || "Request failed";
}

export async function GET() {
  try {
    const brandId = await getCurrentBrandId();

    const [credential, connection] = await Promise.all([
      prisma.providerCredential.findFirst({
        where: {
          brandId,
          provider: "phantombuster",
          isValid: true,
        },
      }),
      prisma.brandConnection.findFirst({
        where: {
          brandId,
          provider: "phantombuster",
        },
      }),
    ]);

    return NextResponse.json({
      connected: Boolean(credential),
      accountLabel: connection?.externalId ?? credential?.label ?? undefined,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/phantombuster/GET]", error);
    return NextResponse.json(
      { error: "Failed to load PhantomBuster connection" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const brandId = await getCurrentBrandId();
    const body = (await request.json()) as { apiKey?: string };
    const apiKey = body.apiKey?.trim() ?? "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    const validationResponse = await fetch(
      "https://api.phantombuster.com/api/v2/user",
      {
        headers: {
          "X-Phantombuster-Key": apiKey,
        },
      }
    );

    if (!validationResponse.ok) {
      return NextResponse.json(
        {
          error: `PhantomBuster validation failed: ${await getErrorText(validationResponse)}`,
        },
        { status: 400 }
      );
    }

    const payload = (await validationResponse.json()) as {
      email?: string;
      name?: string;
      id?: string | number;
    };
    const accountLabel =
      payload.email ??
      payload.name ??
      (payload.id !== undefined ? String(payload.id) : undefined);

    const encryptedValue = encrypt(apiKey);

    await prisma.$transaction(async (tx) => {
      await tx.providerCredential.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: "phantombuster",
          },
        },
        update: {
          label: accountLabel ?? "PhantomBuster",
          encryptedValue,
          isValid: true,
        },
        create: {
          brandId,
          provider: "phantombuster",
          label: accountLabel ?? "PhantomBuster",
          encryptedValue,
          isValid: true,
        },
      });

      await tx.brandConnection.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: "phantombuster",
          },
        },
        update: {
          status: "connected",
          externalId: accountLabel,
        },
        create: {
          brandId,
          provider: "phantombuster",
          status: "connected",
          externalId: accountLabel,
        },
      });
    });

    return NextResponse.json({
      connected: true,
      accountLabel,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/phantombuster/POST]", error);
    return NextResponse.json(
      { error: "Failed to save PhantomBuster connection" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const brandId = await getCurrentBrandId();

    await prisma.$transaction(async (tx) => {
      await tx.providerCredential.updateMany({
        where: {
          brandId,
          provider: "phantombuster",
        },
        data: {
          isValid: false,
        },
      });

      await tx.brandConnection.deleteMany({
        where: {
          brandId,
          provider: "phantombuster",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/phantombuster/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect PhantomBuster" },
      { status: 500 }
    );
  }
}
