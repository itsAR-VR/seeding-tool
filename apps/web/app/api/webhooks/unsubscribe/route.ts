import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/outreach/html-escape";
import {
  verifyUnsubscribeToken,
  addSuppression,
} from "@/lib/compliance/suppression";

/** A small confirmation page that names the brand the person unsubscribed from. */
function unsubscribedPage(brandName: string | null): string {
  const brand = escapeHtml(brandName ?? "us");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8f3ec;color:#1c1c1a;">
<div style="max-width:420px;margin:15vh auto;padding:32px;background:#fff;border-radius:24px;text-align:center;">
<h1 style="font-size:22px;margin:0 0 8px;">You're unsubscribed</h1>
<p style="margin:0;color:#555;line-height:1.5;">You won't get any more emails from ${brand}.</p>
</div></body></html>`;
}

const textResponse = (body: string, status: number) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/plain" } });

/**
 * Shared unsubscribe logic for both GET and POST handlers.
 * Links carry the sending brand (b=) and only opt out of that brand. Older
 * links without a brand opt out of every brand that has this person.
 */
async function processUnsubscribe(
  email: string,
  token: string,
  brandId: string | null
): Promise<NextResponse> {
  const valid = brandId
    ? verifyUnsubscribeToken(email, token, brandId)
    : verifyUnsubscribeToken(email, token);
  if (!valid) return textResponse("Invalid or expired unsubscribe link.", 403);

  try {
    let brandName: string | null = null;
    if (brandId) {
      await addSuppression(email, "UNSUBSCRIBE", brandId);
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
      brandName = brand?.name ?? null;
    } else {
      const creators = await prisma.creator.findMany({
        where: { email: email.toLowerCase().trim() },
        select: { brandId: true, brand: { select: { name: true } } },
      });
      const brandIds = [...new Set(creators.map((c) => c.brandId))];
      if (brandIds.length === 0) {
        await addSuppression(email, "UNSUBSCRIBE", null);
      }
      for (const id of brandIds) {
        await addSuppression(email, "UNSUBSCRIBE", id);
      }
      brandName = brandIds.length === 1 ? (creators[0]?.brand.name ?? null) : null;
    }
    return new NextResponse(unsubscribedPage(brandName), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("[unsubscribe]", error);
    return textResponse("Something went wrong. Please try again later.", 500);
  }
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

  return processUnsubscribe(email, token, request.nextUrl.searchParams.get("b"));
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

  return processUnsubscribe(email, token, request.nextUrl.searchParams.get("b"));
}
