"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Safety net for any page in the app that fails to load. Says what happened
 * in plain words and offers a way forward instead of a blank or raw error.
 */
export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[platform] page failed to load", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">This page didn&apos;t load</h1>
      <p className="text-muted-foreground">
        Something went wrong on our side, not yours. Try again in a moment. Your data is safe.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
