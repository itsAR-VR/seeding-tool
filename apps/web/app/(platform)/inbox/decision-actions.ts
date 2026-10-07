"use client";

import { toast } from "sonner";
import { showUndoToast } from "@/components/undo-toast";
import type { ReplyDecision } from "@/lib/inbox/decision";
import { STAGE_DISPLAY } from "@/lib/stats/stage-display";

/** Fired after an Undo lands, with the thread ids it touched, so open pages can reload. */
export const INBOX_CHANGED_EVENT = "seedscale:inbox-changed";

/** Saves a decision (null clears it). Returns an error message, or null when it saved. */
export async function postDecision(
  threadId: string,
  decision: ReplyDecision | null,
  options: { undo?: boolean } = {},
): Promise<string | null> {
  try {
    const res = await fetch(`/api/inbox/${threadId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, undo: options.undo }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return data.error ?? "Couldn't save their answer. Try again.";
    }
    return null;
  } catch {
    return "Couldn't save their answer. Check your connection and try again.";
  }
}

/** The short button word for a decision: Yes / Not right now / No. */
export function decisionLabel(decision: ReplyDecision): string {
  switch (decision) {
    case "yes":
      return "Yes";
    case "later":
      return "Not right now";
    case "no":
      return "No";
    default: {
      const unhandled: never = decision;
      return unhandled;
    }
  }
}

/** The status words once a decision is saved: Said yes / Not right now / Said no. */
export function decisionStatusLabel(decision: ReplyDecision): string {
  switch (decision) {
    case "yes":
      return STAGE_DISPLAY.said_yes.label;
    case "later":
      return STAGE_DISPLAY.not_now.label;
    case "no":
      return STAGE_DISPLAY.said_no.label;
    default: {
      const unhandled: never = decision;
      return unhandled;
    }
  }
}

/**
 * Show "<message> Undo" for a decision that already saved. Undo puts each
 * thread back to the answer it had before through the same decision API, so
 * leaving "no" lifts the do-not-send entry exactly as changing your mind does.
 */
export function offerUndo({
  message,
  previous,
  onUndone,
}: {
  message: string;
  /** Thread id to the answer it had before (null = still needed her answer). */
  previous: Record<string, ReplyDecision | null>;
  onUndone?: () => void;
}) {
  showUndoToast({
    message,
    onUndo: async () => {
      const ids = Object.keys(previous);
      const errors = await Promise.all(ids.map((id) => postDecision(id, previous[id] ?? null, { undo: true })));
      const failed = errors.filter(Boolean).length;
      window.dispatchEvent(new CustomEvent<string[]>(INBOX_CHANGED_EVENT, { detail: ids }));
      onUndone?.();
      if (failed > 0) {
        toast.error(
          failed === ids.length
            ? "Couldn't undo. Open the conversation and pick their answer again."
            : `Undid ${ids.length - failed}. ${failed} didn't change back; open them to fix.`,
        );
      } else {
        toast("Undone. Their answer is back to how it was.");
      }
    },
  });
}
