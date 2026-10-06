import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { NoCompanyNotice } from "@/components/no-company-notice";
import { AllowAgain } from "./allow-again";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REASON_LABELS: Record<string, string> = {
  DECLINED: "Said no",
  UNSUBSCRIBE: "Unsubscribed",
  REPLY_OPTOUT: "Asked to be removed",
  BOUNCE: "Email bounced",
  COMPLAINT: "Marked as spam",
  MANUAL: "Added manually",
};

export default async function DoNotSendPage() {
  let brandId: string;
  try {
    brandId = (await getCurrentBrandMembership()).brandId;
  } catch (error) {
    if (error instanceof BrandAccessError) return <NoCompanyNotice title="Do-not-send list" />;
    throw error;
  }

  // This brand's opt-outs, plus global blocks (bounces, complaints) for its creators.
  const creators = await prisma.creator.findMany({
    where: { brandId, email: { not: null } },
    select: { email: true, name: true, instagramHandle: true },
  });
  const byEmail = new Map(
    creators.filter((c) => c.email).map((c) => [c.email!.toLowerCase().trim(), c])
  );
  const suppressions = await prisma.emailSuppression.findMany({
    where: {
      OR: [{ brandId }, { brandId: null, email: { in: [...byEmail.keys()] } }],
    },
    orderBy: { suppressedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Do-not-send list</h1>
        <p className="text-muted-foreground">
          These people are never emailed again by your brand, from any campaign. Someone lands here when you
          mark &ldquo;They said no&rdquo;, they unsubscribe, or their email bounces.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {suppressions.length} {suppressions.length === 1 ? "person" : "people"}
          </CardTitle>
          <CardDescription>
            You can allow emails again for anyone you marked &ldquo;no&rdquo;. People who clicked unsubscribe or whose email bounced stay blocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suppressions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is on the list yet.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Creator</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Why</th>
                  <th className="pb-2 font-medium">Since</th>
                  <th className="pb-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => {
                  const creator = byEmail.get(s.email);
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">
                        {creator?.name ?? "No name saved"}
                        {creator?.instagramHandle && (
                          <span className="ml-2 text-muted-foreground">@{creator.instagramHandle}</span>
                        )}
                      </td>
                      <td className="py-2">{s.email}</td>
                      <td className="py-2">
                        <StatusPill tone={s.reason === "BOUNCE" || s.reason === "COMPLAINT" ? "problem" : "neutral"}>
                          {REASON_LABELS[s.reason] ?? s.reason}
                        </StatusPill>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDate(s.suppressedAt)}
                      </td>
                      <td className="py-2 text-right">
                        {s.brandId && (s.reason === "DECLINED" || s.reason === "REPLY_OPTOUT") ? (
                          <AllowAgain id={s.id} name={creator?.name ?? s.email} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
