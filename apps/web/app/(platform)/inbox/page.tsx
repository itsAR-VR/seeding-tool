import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
  snoozed: "bg-yellow-100 text-yellow-800",
};

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await getUserBySupabaseId(authUser.id);
  if (!user) return null;

  const membership = await prisma.brandMembership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
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

  const threads = await prisma.conversationThread.findMany({
    where: { brandId: membership.brandId },
    include: {
      campaignCreator: {
        include: {
          creator: { include: { profiles: true } },
          campaign: { select: { id: true, name: true } },
          aiDrafts: {
            where: { status: "draft" },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">
          Unified inbox for creator communications.
        </p>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4">
        <Badge variant="outline">{threads.length} total threads</Badge>
        {needsReview.length > 0 && (
          <Badge className="bg-purple-100 text-purple-800">
            {needsReview.length} drafts to review
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
