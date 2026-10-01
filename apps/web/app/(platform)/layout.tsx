import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreatorSearchJobsTray } from "@/components/creator-search-jobs-tray";
import { MobileNav, SidebarNav } from "@/components/platform-nav";
import { KeyboardHelp } from "@/components/keyboard-help";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership } from "@/lib/integrations/brand-access";

/** The signed-in company's logo, or its name when it has no logo yet. */
async function BrandMark({ className }: { className: string }) {
  const brand = await getCurrentBrandMembership()
    .then((m) => prisma.brand.findUnique({ where: { id: m.brandId }, select: { name: true, logoUrl: true } }))
    .catch(() => null);
  if (brand?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logoUrl} alt={brand.name} className={className} />;
  }
  return <p className="text-lg font-semibold tracking-tight">{brand?.name ?? "Seed Scale"}</p>;
}


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
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/40 p-6 md:flex">
        <div className="mb-8">
          <BrandMark className="h-7 w-auto" />
        </div>

        <SidebarNav />

        <div className="mt-auto space-y-4 pt-8">
          <KeyboardHelp />
          <p className="truncate text-sm text-muted-foreground">
            {user.email}
          </p>
          <form action="/api/auth/logout" method="POST" className="mt-3">
            <button
              type="submit"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-4 md:hidden">
          <div className="mb-3">
            <BrandMark className="h-6 w-auto" />
          </div>
          <MobileNav />
        </div>
        <div className="mx-auto max-w-6xl">{children}</div>
        <CreatorSearchJobsTray />
      </main>
    </div>
  );
}
