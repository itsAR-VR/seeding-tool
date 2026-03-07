import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">
          Unified inbox for creator communications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            Gmail sync, reply classification, and thread management coming after auth and tenancy are in place.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
