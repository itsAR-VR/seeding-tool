import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SyncReplies } from "./sync-replies";

type InboxTab = "needs" | "waiting" | "yes" | "no" | "all";

const TABS: Array<{ key: InboxTab; label: string }> = [
  { key: "needs", label: "Needs your call" },
  { key: "waiting", label: "Waiting on them" },
  { key: "yes", label: "Said yes" },
  { key: "no", label: "Said no / Not now" },
  { key: "all", label: "All" },
];

function tabFor(thread: {
  campaignCreator: { replyDecision: string | null };
  messages: Array<{ direction: string }>;
}): Exclude<InboxTab, "all"> {
  const decision = thread.campaignCreator.replyDecision;
  if (decision === "no" || decision === "later") return "no";
  if (decision === "yes") return "yes";
  return thread.messages[0]?.direction === "inbound" ? "needs" : "waiting";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  let membership;
  try {
    membership = await getCurrentBrandMembership();
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <Card>
            <CardHeader>
              <CardTitle>No brand found</CardTitle>
              <CardDescription>
                Complete onboarding to access your inbox.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }
    return null;
  }

  const threads = await prisma.conversationThread.findMany({
    where: { brandId: membership.brandId },
    include: {
      campaignCreator: {
        include: {
          creator: { include: { profiles: true } },
          campaign: { select: { id: true, name: true } },
          aiDrafts: {
            where: { status: "draft", type: "reply" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          shippingSnapshots: {
            where: { isActive: false, confirmedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const counts: Record<InboxTab, number> = { needs: 0, waiting: 0, yes: 0, no: 0, all: threads.length };
  for (const t of threads) counts[tabFor(t)]++;
  const activeTab: InboxTab = TABS.some((t) => t.key === tabParam)
    ? (tabParam as InboxTab)
    : counts.needs > 0
      ? "needs"
      : "all";
  const visibleThreads = activeTab === "all" ? threads : threads.filter((t) => tabFor(t) === activeTab);

  const needsReview = threads.filter(
    (t) => t.campaignCreator.aiDrafts.length > 0
  );
  const hasAddress = threads.filter(
    (t) => t.campaignCreator.shippingSnapshots.length > 0
  );
  const decided = threads.filter(
    (t) =>
      (t.campaignCreator.replyDecision === "yes" || t.campaignCreator.replyDecision === "no") &&
      t.campaignCreator.aiSuggestion &&
      t.campaignCreator.aiSuggestion !== "unclear"
  );
  const aiMatches = decided.filter(
    (t) => t.campaignCreator.aiSuggestion === t.campaignCreator.replyDecision
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground">
            Creator replies to your outreach.
          </p>
        </div>
        <SyncReplies />
      </div>

      {/* Quick stats */}
      <div className="flex gap-4">
        <Badge variant="outline">{threads.length} total threads</Badge>
        {needsReview.length > 0 && (
          <Badge className="bg-purple-100 text-purple-800">
            {needsReview.length} drafts to review
          </Badge>
        )}
        <Link href="/settings/do-not-send">
          <Badge variant="outline" className="hover:bg-accent">Do-not-send list →</Badge>
        </Link>
        {decided.length > 0 && (
          <Badge variant="outline">
            AI matched you {aiMatches} of {decided.length}
          </Badge>
        )}
        {hasAddress.length > 0 && (
          <Badge className="bg-teal-100 text-teal-800">
            {hasAddress.length} addresses to confirm
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/inbox?tab=${t.key}`}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              activeTab === t.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t.label} <span className="opacity-70">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {threads.length > 0 && visibleThreads.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing here right now.</p>
      )}

      {threads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No conversations yet</CardTitle>
            <CardDescription>
              When you send outreach to creators and they reply, their
              conversations will appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-2">
          {visibleThreads.map((thread) => {
            const creator = thread.campaignCreator.creator;
            const profile = creator.profiles[0];
            const lastMessage = thread.messages[0];
            const hasDraft = thread.campaignCreator.aiDrafts.length > 0;
            const hasAddr =
              thread.campaignCreator.shippingSnapshots.length > 0;

            return (
              <div key={thread.id} className="relative">
                <Card className="transition-colors hover:bg-muted/50">
                  <Link
                    href={`/inbox/${thread.id}`}
                    aria-label={`Open conversation with ${creator.name ?? profile?.handle ?? "creator"}`}
                    className="absolute inset-0 z-0 rounded-xl"
                  />
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {creator.name ?? profile?.handle ?? "Unknown"}
                        </p>
                        {thread.campaignCreator.replyDecision === "yes" && (
                          <Badge className="bg-green-100 text-green-800">Said yes</Badge>
                        )}
                        {thread.campaignCreator.replyDecision === "no" && (
                          <Badge className="bg-red-100 text-red-800">Said no</Badge>
                        )}
                        {thread.campaignCreator.replyDecision === "later" && (
                          <Badge className="bg-slate-100 text-slate-700">Not right now</Badge>
                        )}
                        {!thread.campaignCreator.replyDecision &&
                          lastMessage?.direction === "inbound" && (
                            <Badge className="bg-amber-100 text-amber-800">Needs your call</Badge>
                          )}
                        {hasDraft && (
                          <Badge className="bg-purple-100 text-purple-800">
                            Suggested reply ready
                          </Badge>
                        )}
                        {hasAddr && (
                          <Badge className="bg-teal-100 text-teal-800">
                            Address
                          </Badge>
                        )}
                      </div>
                      <p className="relative z-10 mt-1 truncate text-sm text-muted-foreground">
                        <Link
                          href={`/campaigns/${thread.campaignCreator.campaign.id}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {thread.campaignCreator.campaign.name}
                        </Link>
                      </p>
                      {lastMessage && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {lastMessage.direction === "inbound" ? "↙ " : "↗ "}
                          {lastMessage.body.slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 shrink-0 text-xs text-muted-foreground">
                      {new Date(thread.updatedAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
