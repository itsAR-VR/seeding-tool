import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">
          Create and manage your seeding campaigns.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign workspace</CardTitle>
          <CardDescription>
            Campaign creation, creator review, and state transitions are coming in Phase 9d.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
