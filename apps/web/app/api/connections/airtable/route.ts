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
          provider: "airtable",
          isValid: true,
        },
      }),
      prisma.brandConnection.findFirst({
        where: {
          brandId,
          provider: "airtable",
        },
      }),
    ]);

    return NextResponse.json({
      connected: Boolean(credential),
      baseId: connection?.externalId ?? credential?.label ?? undefined,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/airtable/GET]", error);
    return NextResponse.json(
      { error: "Failed to load Airtable connection" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const brandId = await getCurrentBrandId();
    const body = (await request.json()) as {
      apiKey?: string;
      baseId?: string;
    };

    const apiKey = body.apiKey?.trim() ?? "";
    const baseId = body.baseId?.trim() ?? "";

    if (!apiKey || !baseId) {
      return NextResponse.json(
        { error: "API key and base ID are required" },
        { status: 400 }
      );
    }

    const validationResponse = await fetch("https://api.airtable.com/v0/meta/whoami", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!validationResponse.ok) {
      return NextResponse.json(
        {
          error: `Airtable validation failed: ${await getErrorText(validationResponse)}`,
        },
        { status: 400 }
      );
    }

    const encryptedValue = encrypt(JSON.stringify({ apiKey, baseId }));

    await prisma.$transaction(async (tx) => {
      await tx.providerCredential.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: "airtable",
          },
        },
        update: {
          label: baseId,
          encryptedValue,
          isValid: true,
        },
        create: {
          brandId,
          provider: "airtable",
          label: baseId,
          encryptedValue,
          isValid: true,
        },
      });

      await tx.brandConnection.upsert({
        where: {
          brandId_provider: {
            brandId,
            provider: "airtable",
          },
        },
        update: {
          status: "connected",
          externalId: baseId,
        },
        create: {
          brandId,
          provider: "airtable",
          status: "connected",
          externalId: baseId,
        },
      });
    });

    return NextResponse.json({
      connected: true,
      baseId,
    });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/airtable/POST]", error);
    return NextResponse.json(
      { error: "Failed to save Airtable connection" },
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
          provider: "airtable",
        },
        data: {
          isValid: false,
        },
      });

      await tx.brandConnection.deleteMany({
        where: {
          brandId,
          provider: "airtable",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ResponseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[connections/airtable/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to disconnect Airtable" },
      { status: 500 }
    );
  }
}
