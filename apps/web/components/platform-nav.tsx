"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Clapperboard,
  Compass,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Package,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

/** The daily loop, in the order work flows through it. */
const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/content", label: "Content", icon: Clapperboard },
  { href: "/ads", label: "Ads", icon: TrendingUp },
];

const SECONDARY: NavItem[] = [
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/creators?find=1", label: "Find creators", icon: Compass },
  // Home lists open problems with everything else that needs you; this is the full history.
  { href: "/interventions", label: "Problems", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings },
];

const FIND_HREF = "/creators?find=1";

/**
 * "Find creators" and "Creators" share a path; ?find=1 (the find panel is
 * open) decides which one is highlighted.
 */
function isActive(pathname: string, href: string, findOpen: boolean) {
  if (href === FIND_HREF) return findOpen && pathname === "/creators";
  if (href === "/creators" && findOpen && pathname === "/creators") return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Current path plus whether the find panel is open. Reads the URL query, so it needs Suspense. */
function useNavLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return { pathname, findOpen: searchParams.get("find") === "1" };
}

function NavLink({ item, pathname, findOpen }: { item: NavItem; pathname: string; findOpen: boolean }) {
  const active = isActive(pathname, item.href, findOpen);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-foreground/80 hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

/** Sidebar navigation for desktop. */
export function SidebarNav() {
  return (
    <Suspense fallback={<SidebarNavPathOnly />}>
      <SidebarNavWithLocation />
    </Suspense>
  );
}

function SidebarNavPathOnly() {
  return <SidebarNavItems pathname={usePathname()} findOpen={false} />;
}

function SidebarNavWithLocation() {
  const { pathname, findOpen } = useNavLocation();
  return <SidebarNavItems pathname={pathname} findOpen={findOpen} />;
}

function SidebarNavItems({ pathname, findOpen }: { pathname: string; findOpen: boolean }) {
  return (
    <nav aria-label="Main" className="space-y-6">
      <div className="space-y-1">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} findOpen={findOpen} />
        ))}
      </div>
      <div className="space-y-1 border-t pt-4">
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} findOpen={findOpen} />
        ))}
      </div>
    </nav>
  );
}

/** Scrollable top navigation for phones, where the sidebar is hidden. */
export function MobileNav() {
  return (
    <Suspense fallback={<MobileNavPathOnly />}>
      <MobileNavWithLocation />
    </Suspense>
  );
}

function MobileNavPathOnly() {
  return <MobileNavItems pathname={usePathname()} findOpen={false} />;
}

function MobileNavWithLocation() {
  const { pathname, findOpen } = useNavLocation();
  return <MobileNavItems pathname={pathname} findOpen={findOpen} />;
}

function MobileNavItems({ pathname, findOpen }: { pathname: string; findOpen: boolean }) {
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto pb-1">
      {[...PRIMARY, ...SECONDARY].map((item) => {
        const active = isActive(pathname, item.href, findOpen);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium",
              active ? "bg-foreground text-background" : "bg-muted text-foreground/80"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
