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
  // The scheduler calls once per brand (?brandId=…) so each brand gets its own
  // 60-second run; without it, run every connected brand (manual/legacy).
  const onlyBrand = new URL(request.url).searchParams.get("brandId");
  const connected = await brandsConnectedTo("gmail");
  const brandIds = onlyBrand ? connected.filter((id) => id === onlyBrand) : connected;
  const results: Record<string, unknown> = {};
  for (const brandId of brandIds) {
    results[brandId] = await syncRepliesForBrand(brandId).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
  }
  return NextResponse.json({ brands: brandIds.length, results });
}
