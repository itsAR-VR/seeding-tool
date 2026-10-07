import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { brandsConnectedTo } from "@/lib/cron/brands";
import { syncRepliesForBrand } from "@/lib/gmail/sync";

export const maxDuration = 60;

/**
 * POST /api/cron/reply-sync — called every 15 minutes by the Supabase scheduler
 * (pg_cron) to pull new creator replies for every brand.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const brandIds = await brandsConnectedTo("gmail");
  const results: Record<string, unknown> = {};
  for (const brandId of brandIds) {
    results[brandId] = await syncRepliesForBrand(brandId).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  return NextResponse.json({ brands: brandIds.length, results });
}
