import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { getShopifyConnectionStatus } from "@/lib/shopify/status";

async function getCurrentBrandId() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Unauthorized");
  }

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) {
    throw new Error("User not found");
  }

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new Error("No brand found");
  }

  return membership.brandId;
}

export async function GET() {
  try {
    const brandId = await getCurrentBrandId();
    return NextResponse.json(await getShopifyConnectionStatus(brandId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Shopify status";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "No brand found"
          ? 404
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
