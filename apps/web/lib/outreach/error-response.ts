import { NextResponse } from "next/server";
import { SuppressedRecipientError } from "@/lib/compliance/suppression";
import {
  AliasPausedError,
  CrossBrandAliasError,
  DailyLimitExceededError,
  GmailNotConnectedError,
} from "@/lib/outreach/errors";

/**
 * Turns the known "can't send this email" errors into a plain-language 4xx
 * response. Returns null for anything unexpected, so the route can log it
 * and answer with its own generic message.
 */
export function emailSendErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof GmailNotConnectedError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DailyLimitExceededError) {
    return NextResponse.json(
      { error: "Today's sending limit is reached. Try again tomorrow." },
      { status: 429 }
    );
  }
  if (error instanceof AliasPausedError) {
    return NextResponse.json(
      { error: "This Gmail inbox is paused. Turn it back on in Settings > Connections." },
      { status: 409 }
    );
  }
  if (error instanceof SuppressedRecipientError) {
    return NextResponse.json(
      { error: "This creator is on your do-not-send list, so we didn't email them." },
      { status: 409 }
    );
  }
  if (error instanceof CrossBrandAliasError) {
    return NextResponse.json(
      { error: "That Gmail inbox belongs to a different company. Pick one of yours." },
      { status: 403 }
    );
  }
  return null;
}
