import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/invites";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const settingsLinks = [
  {
    href: "/settings/brand",
    title: "Brand",
    description: "Update your brand name, website, and logo.",
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
    title: "AI Personas",
    description: "How AI-drafted outreach emails sound.",
  },
  {
    href: "/settings/do-not-send",
    title: "Do-not-send list",
    description: "Creators who said no, unsubscribed, or bounced. They're never emailed again.",
  },
  {
    href: "/admin/health",
    title: "System status",
    description: "Check that email, Shopify, and Instagram are working.",
  },
  {
    href: "/settings/automations",
    title: "Automations",
    description: "Find new creators on a schedule.",
  },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const links = isPlatformAdmin(user?.email)
    ? [
        ...settingsLinks,
        {
          href: "/admin/companies",
          title: "Companies",
          description: "Invite new companies to Seed Scale. Only you see this.",
        },
      ]
    : settingsLinks;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Your brand, connected accounts, and the do-not-send list.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
