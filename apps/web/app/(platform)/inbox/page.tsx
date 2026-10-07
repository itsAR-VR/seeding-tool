import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OPT_OUT_CLASSIFICATION } from "@/lib/inbox/opt-out";
import { SyncReplies } from "./sync-replies";
import { InboxList, type InboxRow } from "./inbox-list";
import { InboxSearch } from "./inbox-search";
import { needsYourCall } from "./next-reply";

type InboxTab = "needs" | "waiting" | "yes" | "no" | "all";

const TABS: Array<{ key: InboxTab; label: string }> = [
  { key: "needs", label: "Needs your call" },
  { key: "waiting", label: "Waiting on them" },
  { key: "yes", label: "Said yes" },
  { key: "no", label: "No or later" },
  { key: "all", label: "All" },
];

const MAX_QUERY_LENGTH = 100;

/** Brand-scoped filter: creator name, handle, email, or any message text. */
function searchWhere(q: string): Prisma.ConversationThreadWhereInput {
  const contains = { contains: q, mode: "insensitive" as const };
  const handle = q.replace(/^@/, "");
  const handleContains = { contains: handle, mode: "insensitive" as const };
  return {
    OR: [
      {
        campaignCreator: {
          creator: {
            OR: [
              { name: contains },
              { email: contains },
              { instagramHandle: handleContains },
              { tiktokHandle: handleContains },
              { profiles: { some: { handle: handleContains } } },
            ],
          },
        },
      },
      { messages: { some: { body: contains } } },
    ],
  };
}

function tabHref(tab: InboxTab, q: string): string {
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  return `/inbox?${params.toString()}`;
}

function tabFor(thread: {
  campaignCreator: { replyDecision: string | null };
  messages: Array<{ direction: string }>;
}): Exclude<InboxTab, "all"> {
  const decision = thread.campaignCreator.replyDecision;
  if (decision === "no" || decision === "later") return "no";
  if (decision === "yes") return "yes";
  return needsYourCall(decision, thread.messages[0]?.direction) ? "needs" : "waiting";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab: tabParam, q: rawQuery } = await searchParams;
  const q = (rawQuery ?? "").trim().slice(0, MAX_QUERY_LENGTH);
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
                Finish setting up your company to use the inbox.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }
    throw error;
  }

  const threads = await prisma.conversationThread.findMany({
    where: q ? { AND: [{ brandId: membership.brandId }, searchWhere(q)] } : { brandId: membership.brandId },
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
          _count: {
            select: { shippingSnapshots: { where: { confirmedAt: { not: null } } } },
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
    : !q && counts.needs > 0
      ? "needs"
      : "all";
  const visibleThreads = activeTab === "all" ? threads : threads.filter((t) => tabFor(t) === activeTab);

  const rows: InboxRow[] = visibleThreads.map((thread) => {
    const cc = thread.campaignCreator;
    const lastMessage = thread.messages[0];
    const decision = cc.replyDecision;
    return {
      id: thread.id,
      name: cc.creator.name ?? cc.creator.profiles[0]?.handle ?? "Unknown creator",
      campaignId: cc.campaign.id,
      campaignName: cc.campaign.name,
      lastMessage: lastMessage ? { direction: lastMessage.direction, body: lastMessage.body.slice(0, 200) } : null,
      updatedAt: new Date(thread.updatedAt).toISOString(),
      decision,
      needsCall: needsYourCall(decision, lastMessage?.direction),
      askedToBeRemoved:
        decision === "no" &&
        lastMessage?.direction === "inbound" &&
        lastMessage.classification === OPT_OUT_CLASSIFICATION,
      hasDraft: cc.aiDrafts.length > 0,
      addressToConfirm: cc.shippingSnapshots.length > 0 && cc._count.shippingSnapshots === 0,
    };
  });

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
          <p className="mt-1 text-muted-foreground">
            Replies from creators you emailed.{" "}
            <Link href="/settings/do-not-send" className="underline hover:text-foreground">
              Do-not-send list
            </Link>
          </p>
        </div>
        <SyncReplies />
      </div>

      <Suspense fallback={<div className="h-10 w-full max-w-md" />}>
        <InboxSearch initialQuery={q} />
      </Suspense>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key, q)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              activeTab === t.key
                ? "bg-foreground text-background"
                : "bg-muted text-foreground/80 hover:bg-muted/70 hover:text-foreground"
            }`}
            aria-current={activeTab === t.key ? "page" : undefined}
          >
            {t.label} <span className="font-semibold tabular-nums">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {decided.length > 0 && (
        <p className="text-sm text-muted-foreground">
          The AI guessed yes or no the same way you did {aiMatches} of {decided.length} times.
        </p>
      )}

      {threads.length > 0 && visibleThreads.length === 0 && (
        <p className="text-muted-foreground">
          {q ? (
            <>
              No conversations match in this tab.{" "}
              <Link href={tabHref("all", q)} className="underline hover:text-foreground">
                See all matches
              </Link>
            </>
          ) : activeTab === "needs" ? (
            "No replies need you right now."
          ) : (
            "Nothing here right now."
          )}
        </p>
      )}

      {q && threads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No conversations match</CardTitle>
            <CardDescription>
              Nothing found for &ldquo;{q}&rdquo;. Try part of their name, their handle, or their
              email.
            </CardDescription>
            <div className="pt-2 text-sm">
              <Link
                href={tabParam ? `/inbox?tab=${encodeURIComponent(tabParam)}` : "/inbox"}
                className="font-medium text-blue-600 hover:underline"
              >
                Clear search
              </Link>
            </div>
          </CardHeader>
        </Card>
      ) : threads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No conversations yet</CardTitle>
            <CardDescription>
              When you email creators and they reply, the conversation shows up here. Start by
              emailing creators from a campaign. Replies come in through Gmail, so connect it first
              if you haven&apos;t.
            </CardDescription>
            <div className="flex flex-wrap gap-3 pt-2 text-sm">
              <Link href="/campaigns" className="font-medium text-blue-600 hover:underline">
                Go to campaigns
              </Link>
              <Link href="/settings/connections" className="font-medium text-blue-600 hover:underline">
                Connect Gmail in Settings &gt; Connections
              </Link>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <InboxList
          key={activeTab}
          rows={rows}
          selectable={activeTab === "needs"}
          showNeedsPill={activeTab !== "needs"}
        />
      )}
    </div>
  );
}
