import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

/**
 * Admin Health Dashboard — Server Component
 *
 * Shows:
 * - Stuck CampaignCreators (lifecycleStatus not updated in >72h and not closed)
 * - Open InterventionCases count
 * - Failed WebhookEvents in last 24h
 * - AIDrafts in "draft" status older than 48h (pending human review)
 */
export default async function AdminHealthPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) {
    redirect("/login");
  }

  // Get the user's brand
  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/onboarding");
  }

  const brandId = membership.brandId;

  const now = new Date();
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const closedStatuses = [
    "posted",
    "completed",
    "opted_out",
    "closed",
  ];

  // Stuck CampaignCreators
  const stuckCreators = await prisma.campaignCreator.findMany({
    where: {
      campaign: { brandId },
      updatedAt: { lt: seventyTwoHoursAgo },
      lifecycleStatus: { notIn: closedStatuses },
    },
    include: {
      creator: { select: { name: true, instagramHandle: true } },
      campaign: { select: { name: true, id: true } },
    },
    take: 50,
  });

  // Open InterventionCases
  const openInterventions = await prisma.interventionCase.findMany({
    where: {
      brandId,
      status: { in: ["open", "in_progress"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Failed WebhookEvents in last 24h
  const failedWebhooks = await prisma.webhookEvent.findMany({
    where: {
      brandId,
      status: "failed",
      createdAt: { gte: twentyFourHoursAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // AIDrafts in "draft" status older than 48h
  const staleDrafts = await prisma.aIDraft.findMany({
    where: {
      status: "draft",
      createdAt: { lt: fortyEightHoursAgo },
      campaignCreator: {
        campaign: { brandId },
      },
    },
    include: {
      campaignCreator: {
        include: {
          creator: { select: { name: true, instagramHandle: true } },
          campaign: { select: { name: true } },
        },
      },
    },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="text-2xl font-bold">System Health</h1>

      {/* Stuck CampaignCreators */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">
          🔴 Stuck CampaignCreators ({stuckCreators.length})
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Creators not updated in &gt;72h and not in a closed state
        </p>
        {stuckCreators.length === 0 ? (
          <p className="text-sm text-green-600">✅ None stuck</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Creator</th>
                <th className="pb-2">Campaign</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {stuckCreators.map((cc) => (
                <tr key={cc.id} className="border-b">
                  <td className="py-2">
                    {cc.creator.name || cc.creator.instagramHandle || "—"}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/campaigns/${cc.campaign.id}`}
                      className="text-blue-600 underline"
                    >
                      {cc.campaign.name}
                    </Link>
                  </td>
                  <td className="py-2">
                    <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-800">
                      {cc.lifecycleStatus}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {cc.updatedAt.toISOString().slice(0, 16)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Open Interventions */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">
          🚨 Open Interventions ({openInterventions.length})
        </h2>
        {openInterventions.length === 0 ? (
          <p className="text-sm text-green-600">✅ None open</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Type</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Priority</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {openInterventions.map((ic) => (
                <tr key={ic.id} className="border-b">
                  <td className="py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5">
                      {ic.type}
                    </span>
                  </td>
                  <td className="py-2">
                    <Link
                      href="/interventions"
                      className="text-blue-600 underline"
                    >
                      {ic.title}
                    </Link>
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded px-2 py-0.5 ${
                        ic.priority === "critical"
                          ? "bg-red-100 text-red-800"
                          : ic.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100"
                      }`}
                    >
                      {ic.priority}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {ic.createdAt.toISOString().slice(0, 16)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Failed Webhooks */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">
          ⚠️ Failed Webhooks (24h) ({failedWebhooks.length})
        </h2>
        {failedWebhooks.length === 0 ? (
          <p className="text-sm text-green-600">✅ No failures</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Provider</th>
                <th className="pb-2">Event Type</th>
                <th className="pb-2">Error</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {failedWebhooks.map((wh) => (
                <tr key={wh.id} className="border-b">
                  <td className="py-2">{wh.provider}</td>
                  <td className="py-2">{wh.eventType}</td>
                  <td className="max-w-xs truncate py-2 text-red-600">
                    {wh.error || "—"}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {wh.createdAt.toISOString().slice(0, 16)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Stale Drafts */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">
          📝 Stale AI Drafts (&gt;48h) ({staleDrafts.length})
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Drafts pending human review for over 48 hours
        </p>
        {staleDrafts.length === 0 ? (
          <p className="text-sm text-green-600">✅ No stale drafts</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Creator</th>
                <th className="pb-2">Campaign</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {staleDrafts.map((draft) => (
                <tr key={draft.id} className="border-b">
                  <td className="py-2">
                    {draft.campaignCreator.creator.name ||
                      draft.campaignCreator.creator.instagramHandle ||
                      "—"}
                  </td>
                  <td className="py-2">
                    {draft.campaignCreator.campaign.name}
                  </td>
                  <td className="py-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-800">
                      {draft.type}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {draft.createdAt.toISOString().slice(0, 16)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
