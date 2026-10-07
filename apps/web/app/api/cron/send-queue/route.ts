import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { sendDueOutreach } from "@/lib/outreach/queue";

export const maxDuration = 60;

/**
 * POST /api/cron/send-queue — called every minute by the Supabase scheduler
 * (pg_cron) while emails are waiting. Sends the ones that are due.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendDueOutreach());
}
