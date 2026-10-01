"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/discover", label: "Find creators", icon: Compass },
  { href: "/interventions", label: "Needs attention", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
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
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      <div className="space-y-1">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
      <div className="space-y-1 border-t pt-4">
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

/** Scrollable top navigation for phones, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto pb-1">
      {[...PRIMARY, ...SECONDARY].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
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
