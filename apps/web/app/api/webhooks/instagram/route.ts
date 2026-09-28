import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { handleInstagramWebhook, type InstagramWebhookBody } from "@/lib/content/webhook";

export const maxDuration = 60;

/** GET — Meta's one-time check that we own this callback URL. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (
    expected &&
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === expected
  ) {
    return new Response(searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function hasValidSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
  );
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** POST — story mentions and caption @mentions of the brand's Instagram account. */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!hasValidSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: InstagramWebhookBody;
  try {
    body = JSON.parse(rawBody) as InstagramWebhookBody;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  try {
    await handleInstagramWebhook(body);
  } catch (error) {
    // Still answer 200 so Meta doesn't disable the subscription over one bad event.
    console.error("[instagram-webhook]", error);
  }
  return NextResponse.json({ ok: true });
}
