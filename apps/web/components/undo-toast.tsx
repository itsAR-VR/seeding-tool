"use client";

import { toast } from "sonner";

/** How long an Undo stays on screen. */
export const UNDO_TOAST_MS = 6000;

/**
 * Say what just happened, with an Undo button, instead of asking first.
 * Uses the app's global toaster so it survives moving to the next page.
 * It never takes focus; the message is announced politely (role="status").
 */
export function showUndoToast({ message, onUndo }: { message: string; onUndo: () => void | Promise<void> }) {
  toast.custom(
    (id) => (
      <div
        role="status"
        className="flex w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-md"
      >
        <p className="flex-1">{message}</p>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(id);
            void onUndo();
          }}
          className="min-h-9 shrink-0 rounded-md border px-3 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Undo
        </button>
      </div>
    ),
    { duration: UNDO_TOAST_MS },
  );
}
