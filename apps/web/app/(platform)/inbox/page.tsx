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

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
  snoozed: "bg-yellow-100 text-yellow-800",
};

export default async function InboxPage() {
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

  const needsReview = threads.filter(
    (t) => t.campaignCreator.aiDrafts.length > 0
  );
  const hasAddress = threads.filter(
    (t) => t.campaignCreator.shippingSnapshots.length > 0
  );
  const decided = threads.filter(
    (t) => t.campaignCreator.replyDecision && t.campaignCreator.aiSuggestion && t.campaignCreator.aiSuggestion !== "unclear"
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
          {threads.map((thread) => {
            const creator = thread.campaignCreator.creator;
            const profile = creator.profiles[0];
            const lastMessage = thread.messages[0];
            const hasDraft = thread.campaignCreator.aiDrafts.length > 0;
            const hasAddr =
              thread.campaignCreator.shippingSnapshots.length > 0;

            return (
              <Link
                key={thread.id}
                href={`/inbox/${thread.id}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {creator.name ?? profile?.handle ?? "Unknown"}
                        </p>
                        <Badge
                          className={
                            statusColors[thread.status] ??
                            statusColors.open
                          }
                        >
                          {thread.status}
                        </Badge>
                        {thread.campaignCreator.replyDecision === "yes" && (
                          <Badge className="bg-green-100 text-green-800">Said yes</Badge>
                        )}
                        {thread.campaignCreator.replyDecision === "no" && (
                          <Badge className="bg-red-100 text-red-800">Said no</Badge>
                        )}
                        {!thread.campaignCreator.replyDecision &&
                          lastMessage?.direction === "inbound" && (
                            <Badge className="bg-amber-100 text-amber-800">Needs your call</Badge>
                          )}
                        {hasDraft && (
                          <Badge className="bg-purple-100 text-purple-800">
                            Draft
                          </Badge>
                        )}
                        {hasAddr && (
                          <Badge className="bg-teal-100 text-teal-800">
                            Address
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {thread.campaignCreator.campaign.name}
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
