import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreatorSearchJobsTray } from "@/components/creator-search-jobs-tray";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/campaigns", label: "Campaigns", icon: "📢" },
  { href: "/creators", label: "Creators", icon: "👤" },
  { href: "/inbox", label: "Inbox", icon: "📬" },
  { href: "/interventions", label: "Interventions", icon: "🚨" },
  { href: "/admin/health", label: "Health", icon: "🏥" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-muted/40 p-6 md:block">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Seed Scale
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <p className="truncate text-xs text-muted-foreground">
            {user.email}
          </p>
          <form action="/api/auth/logout" method="POST" className="mt-3">
            <button
              type="submit"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
        <CreatorSearchJobsTray />
      </main>
    </div>
  );
}
