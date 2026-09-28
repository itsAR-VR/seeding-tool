import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REASON_LABELS: Record<string, string> = {
  DECLINED: "Said no",
  UNSUBSCRIBE: "Unsubscribed",
  BOUNCE: "Email bounced",
  COMPLAINT: "Marked as spam",
  MANUAL: "Added manually",
};

export default async function DoNotSendPage() {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) return null;
    throw error;
  }

  // Suppressions are global by email; show the ones that belong to this brand's creators.
  const creators = await prisma.creator.findMany({
    where: { brandId, email: { not: null } },
    select: { email: true, name: true, instagramHandle: true },
  });
  const byEmail = new Map(
    creators.filter((c) => c.email).map((c) => [c.email!.toLowerCase().trim(), c])
  );
  const suppressions = await prisma.emailSuppression.findMany({
    where: { email: { in: [...byEmail.keys()] } },
    orderBy: { suppressedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Do-not-send list</h1>
        <p className="text-muted-foreground">
          These people are never emailed again, from any campaign. Someone lands here when you
          mark &ldquo;They said no&rdquo;, they unsubscribe, or their email bounces.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {suppressions.length} {suppressions.length === 1 ? "person" : "people"}
          </CardTitle>
          <CardDescription>
            To take someone off, open their conversation in the Inbox and click &ldquo;They said yes&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppressions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is on the list yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Creator</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Why</th>
                  <th className="pb-2 font-medium">Since</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => {
                  const creator = byEmail.get(s.email);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">
                        {creator?.name ?? "—"}
                        {creator?.instagramHandle && (
                          <span className="ml-2 text-muted-foreground">@{creator.instagramHandle}</span>
                        )}
                      </td>
                      <td className="py-2">{s.email}</td>
                      <td className="py-2">
                        <Badge variant="outline">{REASON_LABELS[s.reason] ?? s.reason}</Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {s.suppressedAt.toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
