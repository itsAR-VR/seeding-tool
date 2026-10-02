import { NextRequest, NextResponse } from "next/server";

import { BrandAccessError, getCurrentBrandMembership } from "@/lib/integrations/brand-access";
import {
  isIntegrationMethod,
  isIntegrationProvider,
  supportsMethod,
} from "@/lib/integrations/methods";
import { switchProviderMethod } from "@/lib/integrations/state";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { provider } = await params;
    if (!isIntegrationProvider(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const body = (await request.json()) as { method?: string };
    if (!body.method || !isIntegrationMethod(body.method)) {
      return NextResponse.json({ error: "Invalid method" }, { status: 400 });
    }

    if (!supportsMethod(provider, body.method)) {
      return NextResponse.json(
        { error: "That way of connecting isn't available for this account." },
        { status: 400 }
      );
    }

    const membership = await getCurrentBrandMembership({ requireAdmin: true });
    await switchProviderMethod(membership.brandId, provider, body.method);

    return NextResponse.json({
      success: true,
      provider,
      method: body.method,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[connections/method]", error);
    return NextResponse.json(
      { error: "Couldn't change how this account connects. Try again." },
      { status: 500 }
    );
  }
}
