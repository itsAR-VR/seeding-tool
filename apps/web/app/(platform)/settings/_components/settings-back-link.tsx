"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * "← Settings" above every page reached from Settings. Rendered once by the
 * settings and admin layouts so it sits in the same place on each subpage,
 * and hidden on the Settings page itself.
 */
export function SettingsBackLink() {
  const pathname = usePathname();
  if (pathname === "/settings") return null;
  return (
    <Link
      href="/settings"
      className="-ml-1 mb-2 flex min-h-11 w-fit items-center gap-1 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span aria-hidden>←</span> Settings
    </Link>
  );
}
