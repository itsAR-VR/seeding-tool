import { NextResponse } from "next/server";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { syncRepliesForBrand } from "@/lib/gmail/sync";

/**
 * POST /api/gmail/sync — pull new creator replies from the brand's connected
 * Gmail inboxes into the Inbox.
 */
export async function POST() {
  try {
    const membership = await getCurrentBrandMembership();
    const result = await syncRepliesForBrand(membership.brandId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[gmail/sync]", error);
    return NextResponse.json({ error: "Could not check for replies" }, { status: 500 });
  }
}
