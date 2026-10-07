"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CircleHelp,
  Clapperboard,
  Compass,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openHelp } from "@/components/keyboard-help";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other paths that count as this item (e.g. admin pages live under Settings). */
  alsoActiveOn?: string[];
};

/** The daily loop, in the order work flows through it. */
const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/content", label: "Content", icon: Clapperboard },
  { href: "/ads", label: "Ads", icon: TrendingUp },
];

const PROBLEMS_HREF = "/interventions";

const SECONDARY: NavItem[] = [
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/creators?find=1", label: "Find creators", icon: Compass },
  // Shown only while something is open (Home links to it too), so a quiet week stays quiet.
  { href: PROBLEMS_HREF, label: "Problems", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings, alsoActiveOn: ["/admin"] },
];

const FIND_HREF = "/creators?find=1";

/** What the layout knows about the signed-in person and their company. */
export type NavContext = {
  /** Unresolved problems; the Problems item only shows when this is above zero. */
  openProblems: number;
  email?: string | null;
};

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * "Find creators" and "Creators" share a path; ?find=1 (the find panel is
 * open) decides which one is highlighted.
 */
function isActive(pathname: string, item: NavItem, findOpen: boolean) {
  if (item.href === FIND_HREF) return findOpen && pathname === "/creators";
  if (item.href === "/creators" && findOpen && pathname === "/creators") return false;
  return matchesPath(pathname, item.href) || (item.alsoActiveOn ?? []).some((p) => matchesPath(pathname, p));
}

/** Secondary items to show: Problems only while there are open ones, or while you're on it. */
function secondaryItems(pathname: string, openProblems: number) {
  // Problems always shows so it's easy to find.
  void pathname;
  void openProblems;
  return SECONDARY;
}

/** Current path plus whether the find panel is open. Reads the URL query, so it needs Suspense. */
function useNavLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return { pathname, findOpen: searchParams.get("find") === "1" };
}

type ItemsProps = NavContext & { pathname: string; findOpen: boolean };

function NavLink({ item, pathname, findOpen }: { item: NavItem; pathname: string; findOpen: boolean }) {
  const active = isActive(pathname, item, findOpen);
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
export function SidebarNav(props: NavContext) {
  return (
    <Suspense fallback={<SidebarNavPathOnly {...props} />}>
      <SidebarNavWithLocation {...props} />
    </Suspense>
  );
}

function SidebarNavPathOnly(props: NavContext) {
  return <SidebarNavItems {...props} pathname={usePathname()} findOpen={false} />;
}

function SidebarNavWithLocation(props: NavContext) {
  const { pathname, findOpen } = useNavLocation();
  return <SidebarNavItems {...props} pathname={pathname} findOpen={findOpen} />;
}

function SidebarNavItems({ pathname, findOpen, openProblems }: ItemsProps) {
  return (
    <nav aria-label="Main" className="space-y-6">
      <div className="space-y-1">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} findOpen={findOpen} />
        ))}
      </div>
      <div className="space-y-1 border-t pt-4">
        {secondaryItems(pathname, openProblems).map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} findOpen={findOpen} />
        ))}
      </div>
    </nav>
  );
}

/**
 * Phone navigation, where the sidebar is hidden: the six daily pages as
 * pills, plus a "More" menu with the rest, help, and log out.
 */
export function MobileNav(props: NavContext) {
  return (
    <Suspense fallback={<MobileNavPathOnly {...props} />}>
      <MobileNavWithLocation {...props} />
    </Suspense>
  );
}

function MobileNavPathOnly(props: NavContext) {
  return <MobileNavItems {...props} pathname={usePathname()} findOpen={false} />;
}

function MobileNavWithLocation(props: NavContext) {
  const { pathname, findOpen } = useNavLocation();
  return <MobileNavItems {...props} pathname={pathname} findOpen={findOpen} />;
}

function MobileNavItems({ pathname, findOpen, openProblems, email }: ItemsProps) {
  return (
    <div className="flex items-start gap-1">
      <nav aria-label="Main" className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1">
        {PRIMARY.map((item) => {
          const active = isActive(pathname, item, findOpen);
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
      <MoreMenu pathname={pathname} findOpen={findOpen} openProblems={openProblems} email={email} />
    </div>
  );
}

const MENU_ROW = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium";

function MoreMenu({ pathname, findOpen, openProblems, email }: ItemsProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const items = secondaryItems(pathname, openProblems);
  const activeInside = items.some((item) => isActive(pathname, item, findOpen));

  // Close on Escape and on a tap outside; links close it themselves.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium",
          activeInside ? "bg-foreground text-background" : "bg-muted text-foreground/80"
        )}
      >
        <Menu className="size-4" aria-hidden />
        More
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border bg-background p-2 shadow-lg"
        >
          <nav aria-label="More pages" className="space-y-1">
            {items.map((item) => {
              const active = isActive(pathname, item, findOpen);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(MENU_ROW, active ? "bg-foreground text-background" : "hover:bg-muted")}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 space-y-1 border-t pt-2">
            <button
              type="button"
              className={cn(MENU_ROW, "hover:bg-muted")}
              onClick={() => {
                setOpen(false);
                openHelp();
              }}
            >
              <CircleHelp className="size-4 shrink-0" aria-hidden />
              Help and shortcuts
            </button>
            {email && <p className="truncate px-3 pt-1 text-sm text-muted-foreground">{email}</p>}
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className={cn(MENU_ROW, "hover:bg-muted")}>
                <LogOut className="size-4 shrink-0" aria-hidden />
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
