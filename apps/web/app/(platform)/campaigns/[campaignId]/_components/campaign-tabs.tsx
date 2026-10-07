"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { label: string; path: string };

/** The main row: the places people go every day. */
const TABS: readonly Tab[] = [
  { label: "Overview", path: "" },
  { label: "Email creators", path: "/outreach" },
  { label: "Orders", path: "/orders" },
  { label: "Posts", path: "/mentions" },
  { label: "Results", path: "/analytics" },
];

/**
 * Reachable, but out of the main row. Finding creators is usually started
 * from the Overview's next step; Products lives only here (not on Overview).
 */
const MORE: readonly Tab[] = [
  { label: "Review creators", path: "/review" },
  { label: "Find creators", path: "/discover" },
  { label: "Add from a list", path: "/import" },
  { label: "Products", path: "/products" },
];

/** Only when its features are on in Settings > Features. */
const CREATOR_MIX: Tab = { label: "Suggested creator mix", path: "/seed-list" };

function isActive(pathname: string, base: string, path: string): boolean {
  const href = `${base}${path}`;
  return path === "" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function CampaignTabs({ campaignId, showCreatorMix }: { campaignId: string; showCreatorMix: boolean }) {
  const pathname = usePathname() ?? "";
  const base = `/campaigns/${campaignId}`;
  const more = showCreatorMix ? [...MORE, CREATOR_MIX] : MORE;
  const activeMore = more.find((tab) => isActive(pathname, base, tab.path));

  const tabClass = (active: boolean) =>
    cn(
      "-mb-px inline-flex items-center whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors",
      active
        ? "border-foreground text-foreground"
        : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
    );

  return (
    <nav aria-label="Campaign sections" className="border-b">
      <ul className="flex flex-wrap items-end gap-x-6 gap-y-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, base, tab.path);
          return (
            <li key={tab.label}>
              <Link href={`${base}${tab.path}`} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li className="relative">
          {/* Keyed by path so the menu closes after you pick a page. */}
          <details key={pathname} className="group">
            <summary className={cn(tabClass(Boolean(activeMore)), "cursor-pointer list-none")}>
              {activeMore ? activeMore.label : "More"}
              <span aria-hidden className="ml-1">
                ▾
              </span>
            </summary>
            <ul className="absolute left-0 z-20 mt-1 min-w-48 rounded-lg border bg-popover p-1 shadow-md">
              {more.map((tab) => {
                const active = activeMore === tab;
                return (
                  <li key={tab.label}>
                    <Link
                      href={`${base}${tab.path}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm hover:bg-muted",
                        active && "font-medium",
                      )}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}
