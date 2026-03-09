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
    icon: "🏷️",
  },
  {
    href: "/settings/connections",
    title: "Connections",
    description: "Manage Gmail, Shopify, and other integrations.",
    icon: "🔌",
  },
  {
    href: "/settings/ai-personas",
    title: "AI Personas",
    description: "Manage AI outreach personas and customize message styles.",
    icon: "🤖",
  },
  {
    href: "/settings/automations",
    title: "Automations",
    description: "Schedule recurring creator discovery and other tasks.",
    icon: "⚡",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your workspace, billing, and integrations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{link.icon}</span>
                  {link.title}
                </CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
