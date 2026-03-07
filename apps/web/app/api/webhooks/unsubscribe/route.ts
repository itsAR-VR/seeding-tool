import { NextRequest, NextResponse } from "next/server";
import {
  verifyUnsubscribeToken,
  addSuppression,
} from "@/lib/compliance/suppression";

/**
 * GET /api/webhooks/unsubscribe?email=xxx&token=xxx
 *
 * Public endpoint — no auth required.
 * Handles unsubscribe link clicks.
 *
 * - Verifies HMAC token
 * - Adds suppression
 * - Returns plain text confirmation
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

  // Verify the HMAC token
  if (!verifyUnsubscribeToken(email, token)) {
    return new NextResponse("Invalid or expired unsubscribe link.", {
      status: 400,
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
