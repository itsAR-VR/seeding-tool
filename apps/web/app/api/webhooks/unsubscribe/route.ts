import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/outreach/html-escape";
import {
  verifyUnsubscribeToken,
  addSuppression,
} from "@/lib/compliance/suppression";

/** A small confirmation page that names the brand the person unsubscribed from. */
async function unsubscribedPage(email: string): Promise<string> {
  const creator = await prisma.creator.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { brand: { select: { name: true } } },
  });
  const brand = escapeHtml(creator?.brand.name ?? "us");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8f3ec;color:#1c1c1a;">
<div style="max-width:420px;margin:15vh auto;padding:32px;background:#fff;border-radius:24px;text-align:center;">
<h1 style="font-size:22px;margin:0 0 8px;">You're unsubscribed</h1>
<p style="margin:0;color:#555;line-height:1.5;">You won't get any more emails from ${brand}.</p>
</div></body></html>`;
}

/**
 * Shared unsubscribe logic for both GET and POST handlers.
 */
async function processUnsubscribe(
  email: string,
  token: string
): Promise<NextResponse> {
  if (!verifyUnsubscribeToken(email, token)) {
    return new NextResponse("Invalid or expired unsubscribe link.", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    await addSuppression(email, "UNSUBSCRIBE");
  } catch (error) {
    console.error("[unsubscribe]", error);
    return new NextResponse(
      "Something went wrong. Please try again later.",
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }
    );
  }

  return new NextResponse(await unsubscribedPage(email), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * GET /api/webhooks/unsubscribe?email=xxx&token=xxx
 *
 * Public endpoint — no auth required.
 * Handles unsubscribe link clicks from browsers.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");

  if (!email || !token) {
    return new NextResponse("Invalid unsubscribe link.", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return processUnsubscribe(email, token);
}

/**
 * POST /api/webhooks/unsubscribe?email=xxx&token=xxx
 *
 * RFC 8058 one-click unsubscribe handler.
 * Mail clients send: POST with body "List-Unsubscribe=One-Click"
 * Email + token come from query params (same URL as List-Unsubscribe header).
 */
export async function POST(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");

  if (!email || !token) {
    return new NextResponse("Missing email or token.", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // RFC 8058: body should contain "List-Unsubscribe=One-Click"
  // We validate it's present but proceed regardless — the token is the real auth.
  const body = await request.text();
  if (!body.includes("List-Unsubscribe=One-Click")) {
    console.warn(
      "[unsubscribe/POST] Unexpected body (expected RFC 8058 one-click):",
      body.slice(0, 200)
    );
  }

  return processUnsubscribe(email, token);
}
