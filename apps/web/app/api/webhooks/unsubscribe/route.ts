import { NextRequest, NextResponse } from "next/server";
import {
  verifyUnsubscribeToken,
  addSuppression,
} from "@/lib/compliance/suppression";

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

  return new NextResponse("You have been unsubscribed.", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
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
