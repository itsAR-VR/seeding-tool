import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { brandsConnectedTo } from "@/lib/cron/brands";
import { syncContentForBrand } from "@/lib/content/sync";

export const maxDuration = 60;

/**
 * POST /api/cron/content-sync — called every 15 minutes by the Supabase scheduler
 * (pg_cron) to pull new tagged posts for every brand.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const brandIds = await brandsConnectedTo("instagram");
  const results: Record<string, unknown> = {};
  for (const brandId of brandIds) {
    results[brandId] = await syncContentForBrand(brandId).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  return NextResponse.json({ brands: brandIds.length, results });
}
