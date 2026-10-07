"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";

const GO_TO: Record<string, { href: string; label: string }> = {
  h: { href: "/dashboard", label: "Home" },
  c: { href: "/campaigns", label: "Campaigns" },
  i: { href: "/inbox", label: "Inbox" },
  o: { href: "/orders", label: "Orders" },
  p: { href: "/content", label: "Content (posts)" },
  a: { href: "/ads", label: "Ads" },
  s: { href: "/settings", label: "Settings" },
};

/** Window event that opens the help dialog, so any button (sidebar or phone menu) can open it. */
const OPEN_HELP_EVENT = "seedscale:open-help";

/** Open the help and shortcuts dialog from anywhere on the page. */
export function openHelp() {
  window.dispatchEvent(new Event(OPEN_HELP_EVENT));
}

/** The "Help and shortcuts" button for the desktop sidebar. */
export function HelpButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openHelp}
      className={
        className ??
        "flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      <CircleHelp className="size-4" aria-hidden />
      Help and shortcuts
    </button>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Keyboard shortcuts ("g" then a letter to jump between pages, "?" for help)
 * plus the help dialog that explains how the tool works in one screen.
 * Mount it once per page (outside anything hidden on phones); open it with
 * <HelpButton /> or openHelp().
 */
export function KeyboardHelp() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let waitingForGo = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || isTyping(event.target)) return;
      // Leave keys alone while a dialog is open (Escape closes it natively).
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "?") {
        event.preventDefault();
        dialogRef.current?.showModal();
        return;
      }
      if (waitingForGo) {
        waitingForGo = false;
        clearTimeout(timer);
        const dest = GO_TO[event.key.toLowerCase()];
        if (dest) {
          event.preventDefault();
          router.push(dest.href);
        }
        return;
      }
      if (event.key === "g") {
        waitingForGo = true;
        timer = setTimeout(() => (waitingForGo = false), 1200);
      }
    }

    function onOpen() {
      if (!dialogRef.current?.open) dialogRef.current?.showModal();
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_HELP_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_HELP_EVENT, onOpen);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="help-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/30"
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="space-y-5 p-6">
        <div>
          <h2 id="help-title" className="text-lg font-semibold">How it works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Make a campaign, add a product and creators, then email them.</li>
            <li>Replies land in the Inbox. Mark each one yes, not now, or no.</li>
            <li>Send a yes the address link. Their gift order appears in Shopify to complete.</li>
            <li>Posts that tag you show up in Content. Ask for rights, then make an ad.</li>
          </ol>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Shortcuts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Press <kbd className="rounded border px-1">g</kbd>, then a letter:
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {Object.entries(GO_TO).map(([key, dest]) => (
              <li key={key} className="flex justify-between">
                <span>{dest.label}</span>
                <kbd className="rounded border px-1.5">{key}</kbd>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            In a conversation: <kbd className="rounded border px-1">y</kbd> they said yes,{" "}
            <kbd className="rounded border px-1">l</kbd> not right now,{" "}
            <kbd className="rounded border px-1">n</kbd> they said no,{" "}
            <kbd className="rounded border px-1">j</kbd> next reply that needs you,{" "}
            <kbd className="rounded border px-1">k</kbd> previous one.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
