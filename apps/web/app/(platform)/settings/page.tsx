import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/invites";
import { ChevronRight } from "lucide-react";

const settingsLinks = [
  {
    href: "/settings/brand",
    title: "Brand",
    description: "Your brand name, website, and who approves new creators.",
  },
  {
    href: "/settings/brand-kit",
    title: "Brand kit",
    description: "Logo, product facts for AI replies, your \"yes\" message, and ad defaults.",
  },
  {
    href: "/settings/team",
    title: "Team",
    description: "Invite teammates and see who has access.",
  },
  {
    href: "/settings/connections",
    title: "Connections",
    description: "Gmail, Shopify, and Instagram.",
  },
  {
    href: "/settings/ai-personas",
    title: "Writing styles",
    description: "How suggested outreach emails sound.",
  },
  {
    href: "/settings/do-not-send",
    title: "Do-not-send list",
    description: "Creators who said no, unsubscribed, or bounced. They're never emailed again.",
  },
  {
    href: "/admin/health",
    title: "System status",
    description: "Anything stuck: emails that didn't send, orders or product updates that failed.",
  },
  {
    href: "/settings/creator-search",
    title: "Creator search",
    description: "Which account pays for creator searches.",
  },
  {
    href: "/settings/feature-flags",
    title: "Features",
    description: "Turn parts of the tool on or off, like Shopify gift orders and Instagram messages.",
  },
  {
    href: "/settings/automations",
    title: "Scheduled searches",
    description: "Find new creators every day or week, automatically.",
  },
];

const GROUPS: Array<{ title: string; hrefs: string[] }> = [
  { title: "Your brand", hrefs: ["/settings/brand", "/settings/brand-kit", "/settings/ai-personas", "/settings/team"] },
  { title: "Accounts and creator search", hrefs: ["/settings/connections", "/settings/creator-search", "/settings/automations"] },
  { title: "Safety and status", hrefs: ["/settings/do-not-send", "/admin/health", "/settings/feature-flags"] },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const byHref = new Map(settingsLinks.map((l) => [l.href, l]));
  const groups = GROUPS.map((g) => ({ title: g.title, links: g.hrefs.map((h) => byHref.get(h)).filter((l) => l !== undefined) }));
  if (isPlatformAdmin(user?.email)) {
    groups.push({
      title: "Only you see this",
      links: [{ href: "/admin/companies", title: "Companies", description: "Invite new companies to Seed Scale." }],
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Your brand, connected accounts, and the do-not-send list.</p>
      </header>

      {groups.map((group) => (
        <section key={group.title} className="space-y-3" aria-labelledby={`group-${group.title}`}>
          <h2 id={`group-${group.title}`} className="text-lg font-semibold">
            {group.title}
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{link.title}</span>
                    <span className="block text-sm text-muted-foreground">{link.description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
