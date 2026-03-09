import { NextRequest, NextResponse } from "next/server";

import { getCurrentBrandMembership } from "@/lib/integrations/brand-access";
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
        { error: `${provider} does not support ${body.method}` },
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
    const message =
      error instanceof Error ? error.message : "Failed to update method";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "User not found" || message === "No brand found"
          ? 404
          : message === "Admin access required"
            ? 403
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
