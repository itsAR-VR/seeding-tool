"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 300;

/** Search box for the inbox. Updates ?q= after a short pause; the server does the filtering. */
export function InboxSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  // The query this box last put in the address bar.
  const [pushed, setPushed] = useState(initialQuery);
  const [seenQuery, setSeenQuery] = useState(initialQuery);

  // The query changed from outside (e.g. the Clear search link): show it in the box.
  if (initialQuery !== seenQuery) {
    setSeenQuery(initialQuery);
    if (initialQuery !== pushed) {
      setPushed(initialQuery);
      setValue(initialQuery);
    }
  }

  useEffect(() => {
    const next = value.trim();
    if (next === pushed) return;
    const timer = window.setTimeout(() => {
      setPushed(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, pushed, pathname, router, searchParams]);

  return (
    <div className="relative w-full max-w-md">
      <label htmlFor="inbox-search" className="sr-only">
        Search conversations
      </label>
      <input
        id="inbox-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            setValue("");
          }
        }}
        placeholder="Search by name, handle, email or message"
        className="h-10 w-full rounded-lg border bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        autoComplete="off"
      />
      {pending && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-live="polite">
          Searching…
        </span>
      )}
    </div>
  );
}
