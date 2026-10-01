import Link from "next/link";
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

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Your brand, connected accounts, and the do-not-send list.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsLinks.map((link) => (
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
