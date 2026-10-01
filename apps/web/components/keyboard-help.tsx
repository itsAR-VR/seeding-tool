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

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Keyboard shortcuts ("g" then a letter to jump between pages, "?" for help)
 * plus a help button that explains how the tool works in one screen.
 */
export function KeyboardHelp() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let waitingForGo = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
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

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <CircleHelp className="size-4" aria-hidden />
        Help and shortcuts
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/30"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">How it works</h2>
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
              <kbd className="rounded border px-1">n</kbd> they said no.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
