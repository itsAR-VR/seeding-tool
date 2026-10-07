"use client";

import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guessFromIntent, type AiReplyGuess, type ReplyDecision } from "@/lib/inbox/decision";
import { OPT_OUT_CLASSIFICATION } from "@/lib/inbox/opt-out";
import { formatDateTime } from "@/lib/format/date";
import { adjacentReply, type QueueDirection } from "../next-reply";
import { INBOX_CHANGED_EVENT, decisionStatusLabel, offerUndo, postDecision } from "../decision-actions";

type Message = {
  id: string;
  direction: string;
  body: string;
  subject: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  classification: string | null;
  confidence: number | null;
  createdAt: string;
};

type AIDraft = {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  body: string;
  createdAt: string;
};

type ShippingSnapshot = {
  id: string;
  fullName: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  source: string;
  isActive: boolean;
  confirmedAt: string | null;
};

type Thread = {
  id: string;
  subject: string | null;
  status: string;
  channel: string; // email | instagram_dm
  externalThreadId: string | null;
  unipileChatId: string | null;
  campaignCreator: {
    id: string;
    lifecycleStatus: string;
    replyDecision: ReplyDecision | null;
    creator: {
      id: string;
      name: string | null;
      email: string | null;
      instagramHandle: string | null;
      profiles: Array<{
        platform: string;
        handle: string;
        followerCount: number | null;
      }>;
    };
    campaign: { id: string; name: string };
    aiDrafts: AIDraft[];
    shippingSnapshots: ShippingSnapshot[];
  };
  messages: Message[];
};

type BrandData = {
  id: string;
  emailAliases?: Array<{
    id: string;
    address: string;
    displayName: string | null;
    isPrimary: boolean;
  }>;
};

const ADDRESS_LINK = "{address link}";

/** Keyed by thread so moving to the next reply starts fresh (no stale notices or drafts). */
export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  return <ThreadDetail key={params.threadId} threadId={params.threadId} />;
}

function isTyping(el: HTMLElement | null) {
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

function ThreadDetail({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  // The brand's "they said yes" message, from its brand kit.
  const [followUp, setFollowUp] = useState("");
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [replySending, setReplySending] = useState(false);
  // Inline "Send to name@email? Send / Cancel" row, instead of a browser confirm.
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [replyNotice, setReplyNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // What she just did here ("Saved: Not right now."), shown next to "Next reply".
  const [doneLine, setDoneLine] = useState<string | null>(null);
  // "Needs your answer" queue: the order when this thread opened, and what still waits now.
  const [queueOrder, setQueueOrder] = useState<string[] | null>(null);
  const [queueWaiting, setQueueWaiting] = useState<string[]>([]);

  const refreshQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/queue");
      if (!res.ok) return;
      const { ids } = (await res.json()) as { ids: string[] };
      setQueueOrder((prev) => prev ?? ids);
      setQueueWaiting(ids);
    } catch {
      // Keep the last known queue; the inbox list still works.
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    async function load() {
      try {
        // The brand only fills in details, so it never holds up the conversation.
        void fetch("/api/brands/current")
          .then((res) => (res.ok ? (res.json() as Promise<BrandData>) : null))
          .then((data) => data && setBrand(data))
          .catch(() => undefined);
        const threadRes = await fetch(`/api/inbox/${threadId}`);

        if (threadRes.ok) {
          const loaded = (await threadRes.json()) as Thread & { followUpTemplate: string };
          setThread(loaded);
          setFollowUp(loaded.followUpTemplate);
          const suggestion = loaded.campaignCreator.aiDrafts.find(
            (d) => d.type === "reply" && d.status === "draft"
          );
          // Only start from the "yes" message when this looks like a yes. A "no"
          // or "not now" usually needs no reply, so start empty.
          const lastIn = [...loaded.messages].reverse().find((m) => m.direction === "inbound");
          const guess = loaded.campaignCreator.replyDecision ?? guessFromIntent(lastIn?.classification);
          if (suggestion) {
            setReplyText(suggestion.body);
            setSuggestionId(suggestion.id);
          } else if (guess === "yes") {
            setReplyText(loaded.followUpTemplate);
          } else {
            setReplyText("");
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [threadId]);

  const reloadThread = useCallback(async () => {
    const res = await fetch(`/api/inbox/${threadId}`);
    if (res.ok) setThread((await res.json()) as Thread);
  }, [threadId]);

  const saveDecision = (decision: ReplyDecision) => postDecision(threadId, decision);

  // An Undo (from this page or one she already left) changed the inbox: catch up.
  useEffect(() => {
    function onChanged(event: Event) {
      const ids = (event as CustomEvent<string[]>).detail ?? [];
      if (ids.includes(threadId)) {
        setDoneLine(null);
        void reloadThread();
      }
      void refreshQueue();
    }
    window.addEventListener(INBOX_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(INBOX_CHANGED_EVENT, onChanged);
  }, [threadId, reloadThread, refreshQueue]);

  // No confirm: save now, then offer Undo for 6 seconds.
  async function handleDecision(decision: ReplyDecision) {
    if (!thread) return;
    const before = thread.campaignCreator.replyDecision ?? null;
    setDeciding(true);
    setDecisionError(null);
    try {
      const error = await saveDecision(decision);
      if (error) {
        setDecisionError(error);
        return;
      }
      const status = decisionStatusLabel(decision);
      setDoneLine(`Saved: ${status}.`);
      offerUndo({
        message:
          decision === "no" ? `Saved: ${status}. Added to the do-not-send list.` : `Saved: ${status}.`,
        previous: { [threadId]: before },
      });
      await Promise.all([reloadThread(), refreshQueue()]);
    } finally {
      setDeciding(false);
    }
  }

  const nextId = adjacentReply(queueOrder ?? [], queueWaiting, threadId, "next");
  const previousId = adjacentReply(queueOrder ?? [], queueWaiting, threadId, "previous");

  // j / k move through the replies that need her answer (skipped while typing).
  const goRef = useRef<(direction: QueueDirection) => void>(() => undefined);
  goRef.current = (direction) => {
    const id = direction === "next" ? nextId : previousId;
    if (id) router.push(`/inbox/${id}`);
  };
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (document.querySelector("dialog[open]") || el?.closest("dialog") || isTyping(el)) return;
      const key = event.key.toLowerCase();
      if (key !== "j" && key !== "k") return;
      event.preventDefault();
      goRef.current(key === "j" ? "next" : "previous");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSendReply() {
    if (!replyText.trim() || !thread) return;
    setConfirmingSend(false);
    // A gift link only makes sense for a yes; record it first so the gift flow stays right.
    const autoYes = replyText.includes(ADDRESS_LINK) && !thread.campaignCreator.replyDecision;
    setReplySending(true);
    setReplyNotice(null);
    try {
      if (autoYes) {
        const error = await saveDecision("yes");
        if (error) {
          setReplyNotice({ tone: "error", text: `Nothing was sent. ${error}` });
          return;
        }
      }
      const res = await fetch(`/api/inbox/${threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText, draftId: suggestionId ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const reason = data.error ?? "Your reply didn't send. Try again.";
        setReplyNotice({
          tone: "error",
          text: autoYes ? `${reason} Their answer is now ${decisionStatusLabel("yes")}.` : reason,
        });
        if (autoYes) await reloadThread();
        return;
      }
      setReplyNotice({
        tone: "success",
        text: replyText.includes(ADDRESS_LINK)
          ? autoYes
            ? `Reply sent with their gift link. Their answer is now ${decisionStatusLabel("yes")}.`
            : "Reply sent with their gift link."
          : "Reply sent.",
      });
      setReplyText("");
      setSuggestionId(null);
      await Promise.all([reloadThread(), refreshQueue()]);
    } catch {
      setReplyNotice({ tone: "error", text: "Your reply didn't send. Check your connection and try again." });
      if (autoYes) await reloadThread().catch(() => undefined);
    } finally {
      setReplySending(false);
    }
  }

  // INVARIANT: DM send only on explicit human action — never automated
  async function handleSendDm() {
    if (!dmText.trim()) return;
    setDmSending(true);
    setDmError(null);
    try {
      const res = await fetch(`/api/inbox/${threadId}/send-dm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: dmText.trim() }),
      });

      if (res.ok) {
        setDmText("");
        // Refresh thread
        const threadRes = await fetch(`/api/inbox/${threadId}`);
        if (threadRes.ok) {
          setThread((await threadRes.json()) as Thread);
        }
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDmError(data?.error || "Your Instagram message didn't send. Try again.");
      }
    } catch {
      setDmError("Your Instagram message didn't send. Check your connection and try again.");
    } finally {
      setDmSending(false);
    }
  }

  // y / l / n mark the decision, like the buttons (skipped while typing).
  const decisionKeyRef = useRef(handleDecision);
  decisionKeyRef.current = handleDecision;
  const canDecide = Boolean(thread?.messages.some((m) => m.direction === "inbound")) && !deciding;
  useEffect(() => {
    if (!canDecide) return;
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      // Not while a dialog (e.g. Help) is open or the key came from inside one.
      if (document.querySelector("dialog[open]") || el?.closest("dialog")) return;
      if (isTyping(el)) return;
      const decision = ({ y: "yes", l: "later", n: "no" } as const)[event.key.toLowerCase() as "y" | "l" | "n"];
      if (!decision) return;
      event.preventDefault();
      void decisionKeyRef.current(decision);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canDecide]);

  if (loading) {
    return (
      <div role="status" aria-busy="true" className="max-w-3xl space-y-4">
        <span className="sr-only">Loading conversation…</span>
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-32 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Conversation not found</h1>
        <p className="text-muted-foreground">
          It may have been removed, or it belongs to a different company. Go back to your inbox to
          see your conversations.
        </p>
        <Button variant="outline" onClick={() => router.push("/inbox")}>
          Back to inbox
        </Button>
      </div>
    );
  }

  const creator = thread.campaignCreator.creator;
  const profile = creator.profiles[0];
  const creatorName = creator.name ?? profile?.handle ?? "Unknown creator";
  // Feature their latest reply; if they haven't replied, the latest message we sent.
  const featured =
    [...thread.messages].reverse().find((m) => m.direction === "inbound") ??
    thread.messages[thread.messages.length - 1];
  const earlier = thread.messages.filter((m) => m.id !== featured?.id);
  const latestInbound = [...thread.messages].reverse().find((m) => m.direction === "inbound");
  const pendingAddresses = thread.campaignCreator.shippingSnapshots.filter(
    (s) => !s.confirmedAt && !s.isActive
  );
  const decision = thread.campaignCreator.replyDecision;
  const showReply = thread.channel === "email" && decision !== "no";
  const needsGiftLink = decision === "yes" && !replyText.includes(ADDRESS_LINK);
  const willAutoYes = replyText.includes(ADDRESS_LINK) && !decision;

  /** One click: start from the gift-link message, or add the link to what she wrote. */
  function addGiftLink() {
    setConfirmingSend(false);
    setReplyText((text) => (text.trim() ? `${text.trimEnd()}\n\n${ADDRESS_LINK}` : followUp));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              <Link href={`/creators/${creator.id}`} className="hover:underline">
                {creatorName}
              </Link>
            </h1>
            {thread.status === "closed" && <Badge variant="outline">Closed</Badge>}
            {thread.channel === "instagram_dm" && <Badge variant="outline">Instagram DM</Badge>}
          </div>
          <p className="mt-1 text-muted-foreground">
            <Link href={`/campaigns/${thread.campaignCreator.campaign.id}`} className="hover:underline">
              {thread.campaignCreator.campaign.name}
            </Link>
            {profile && ` · @${profile.handle}`}
            {profile?.followerCount != null &&
              ` · ${profile.followerCount.toLocaleString()} followers`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/inbox")}>
            Back to inbox
          </Button>
          <NextReplyButton nextId={nextId} variant="outline" />
        </div>
      </div>

      {/* Their latest message, shown first so the decision below reads in context */}
      {featured && (
        <figure className="rounded-xl border bg-card p-5 shadow-sm">
          <figcaption className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {featured.direction === "inbound" ? creatorName : "You"}
            </span>{" "}
            wrote, <time dateTime={featured.createdAt}>{formatDateTime(featured.createdAt)}</time>:
          </figcaption>
          {featured.subject && <p className="mt-2 font-medium">{featured.subject}</p>}
          <blockquote className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50/70 px-4 py-3 text-base leading-relaxed">
            {featured.body}
          </blockquote>
          {featured.direction === "outbound" && (
            <p className="mt-3 text-sm text-muted-foreground">No reply from them yet.</p>
          )}
        </figure>
      )}
      {!featured && <p className="text-muted-foreground">No messages in this conversation yet.</p>}

      {/* Step 1: their answer, right under their message (keys y / l / n) */}
      {latestInbound && (
        <DecisionChoice
          step={showReply ? 1 : null}
          decision={thread.campaignCreator.replyDecision}
          aiGuess={guessFromIntent(latestInbound.classification)}
          confidence={latestInbound.confidence}
          askedToBeRemoved={
            thread.campaignCreator.replyDecision === "no" &&
            latestInbound.classification === OPT_OUT_CLASSIFICATION
          }
          deciding={deciding}
          error={decisionError}
          onDecide={(d) => void handleDecision(d)}
          after={
            doneLine && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                {/* The Undo toast announces it; this line is the visible next step. */}
                <p className="font-medium">{doneLine}</p>
                <NextReplyButton nextId={nextId} size="sm" />
              </div>
            )
          }
        />
      )}

      {/* Step 2: the reply */}
      {showReply && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {latestInbound && <StepNumber n={2} />}
              {suggestionId ? "Your reply (suggested, edit it before sending)" : "Your reply"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {replyNotice && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm ${
                  replyNotice.tone === "success"
                    ? "border-green-200 bg-green-50 text-green-900"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p role={replyNotice.tone === "success" ? "status" : "alert"}>{replyNotice.text}</p>
                {replyNotice.tone === "success" && <NextReplyButton nextId={nextId} size="sm" />}
              </div>
            )}
            {needsGiftLink && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p>They said yes. This reply doesn&apos;t have their gift link yet.</p>
                <Button size="sm" variant="outline" onClick={addGiftLink}>
                  Add the gift link
                </Button>
              </div>
            )}
            <textarea
              className="w-full min-h-40 rounded-md border p-3 text-sm leading-relaxed"
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
                setConfirmingSend(false);
              }}
              placeholder="Write your reply…"
              aria-label="Your reply"
            />
            {confirmingSend ? (
              <SendConfirm
                to={creator.email ?? creatorName}
                alsoMarksYes={willAutoYes}
                sending={replySending}
                onSend={() => void handleSendReply()}
                onCancel={() => setConfirmingSend(false)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {replyText.includes(ADDRESS_LINK)
                    ? `${ADDRESS_LINK} becomes their private gift link to add a shipping address.`
                    : `To: ${creator.email ?? "no email on file"}`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {!replyText.includes(ADDRESS_LINK) && !decision && (
                    <Button variant="ghost" onClick={() => setReplyText(followUp)}>
                      Use the gift link message
                    </Button>
                  )}
                  <Button
                    onClick={() => setConfirmingSend(true)}
                    disabled={replySending || !replyText.trim()}
                    className="px-5"
                  >
                    {replySending ? "Sending…" : "Send reply"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DM Compose — Instagram DM threads only */}
      {thread.channel === "instagram_dm" && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle className="text-base text-indigo-900">
              📱 Send Instagram DM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dmError && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                {dmError}
                {dmError.includes("Settings > Features") && (
                  <>
                    {" "}
                    <Link href="/settings/feature-flags" className="font-medium underline">
                      Open Settings &gt; Features
                    </Link>
                  </>
                )}
              </div>
            )}
            <textarea
              className="w-full min-h-20 rounded-md border p-3 text-sm"
              placeholder="Type your DM message…"
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Sending to @{creator.instagramHandle || "unknown"}
              </p>
              <Button
                size="sm"
                onClick={handleSendDm}
                disabled={dmSending || !dmText.trim()}
              >
                {dmSending ? "Sending…" : "Send DM"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Address Snapshot */}
      {pendingAddresses.length > 0 && (
        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <CardTitle className="text-base text-teal-900">
              Address to check
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingAddresses.map((addr) => (
              <div key={addr.id} className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {addr.fullName && (
                    <p>
                      <span className="font-medium">Name:</span>{" "}
                      {addr.fullName}
                    </p>
                  )}
                  {addr.line1 && (
                    <p>
                      <span className="font-medium">Address:</span>{" "}
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ""}
                    </p>
                  )}
                  {addr.city && (
                    <p>
                      <span className="font-medium">City:</span> {addr.city}
                    </p>
                  )}
                  {addr.state && (
                    <p>
                      <span className="font-medium">State:</span>{" "}
                      {addr.state}
                    </p>
                  )}
                  {addr.postalCode && (
                    <p>
                      <span className="font-medium">ZIP:</span>{" "}
                      {addr.postalCode}
                    </p>
                  )}
                  {addr.country && (
                    <p>
                      <span className="font-medium">Country:</span>{" "}
                      {addr.country}
                    </p>
                  )}
                  {addr.phone && (
                    <p>
                      <span className="font-medium">Phone:</span>{" "}
                      {addr.phone}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Source: {addr.source}
                </p>
                <div className="flex gap-2">
                  <Button size="sm">Confirm Address</Button>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Earlier messages, collapsed: the latest one is already shown above */}
      {earlier.length > 0 && (
        <details className="group rounded-xl border bg-card">
          <summary className="cursor-pointer select-none px-5 py-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Earlier messages ({earlier.length})
          </summary>
          <ol className="space-y-4 px-5 pb-5">
            {earlier.map((msg) => (
              <li
                key={msg.id}
                className={`rounded-lg p-3 ${msg.direction === "inbound" ? "bg-muted/50" : "ml-8 bg-blue-50"}`}
              >
                <p className="mb-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {msg.direction === "inbound" ? `${creatorName} wrote` : "You wrote"}
                  </span>
                  {msg.fromAddress && msg.direction === "inbound" && ` from ${msg.fromAddress}`}
                  {", "}
                  <time dateTime={msg.createdAt}>{formatDateTime(msg.createdAt)}</time>
                </p>
                {msg.subject && <p className="mb-1 text-sm font-medium">{msg.subject}</p>}
                <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

const CHOICES: Array<{ value: ReplyDecision; label: string; key: string }> = [
  { value: "yes", label: "Yes", key: "y" },
  { value: "later", label: "Not right now", key: "l" },
  { value: "no", label: "No", key: "n" },
];

/** "Next reply →" to the next one that needs her call, or a quiet note when none are left. */
function NextReplyButton({
  nextId,
  variant = "default",
  size = "default",
}: {
  nextId: string | null;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  if (!nextId) {
    return (
      <Button variant={variant} size={size} disabled>
        No more replies waiting
      </Button>
    );
  }
  return (
    <Link href={`/inbox/${nextId}`} aria-keyshortcuts="j" className={buttonVariants({ variant, size })}>
      Next reply <span aria-hidden="true">→</span>
    </Link>
  );
}

/** Small round step number ("1", "2") so the order on the page reads at a glance. */
function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
    >
      {n}
    </span>
  );
}

/** The inline check before a reply goes out: "Send to name@email? Send / Cancel". */
function SendConfirm({
  to,
  alsoMarksYes,
  sending,
  onSend,
  onCancel,
}: {
  to: string;
  alsoMarksYes: boolean;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  const sendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    sendRef.current?.focus();
  }, []);
  return (
    <div
      role="group"
      aria-label="Confirm send"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <p className="text-sm">
        Send to <span className="font-medium">{to}</span>?
        {alsoMarksYes && <span className="text-muted-foreground"> This also saves their answer as Yes.</span>}
      </p>
      <div className="flex gap-2">
        <Button ref={sendRef} onClick={onSend} disabled={sending} className="px-5">
          {sending ? "Sending…" : "Send"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Step 1, their answer: a compact segmented choice right under their message. */
function DecisionChoice({
  step,
  decision,
  aiGuess,
  confidence,
  askedToBeRemoved,
  deciding,
  error,
  onDecide,
  after,
}: {
  /** Step number when the reply box follows, or null when this is the only step. */
  step: number | null;
  decision: ReplyDecision | null;
  aiGuess: AiReplyGuess | null;
  confidence: number | null;
  askedToBeRemoved: boolean;
  deciding: boolean;
  error: string | null;
  onDecide: (decision: ReplyDecision) => void;
  after?: React.ReactNode;
}) {
  const hint = askedToBeRemoved
    ? "They asked us to stop emailing, so they're on the do-not-send list. Pick Yes or Not right now if that's wrong."
    : decision === "no"
      ? "They're on the do-not-send list."
      : decision === "later"
        ? "Parked. They're not on the do-not-send list."
        : aiGuess === "yes" || aiGuess === "no"
          ? `Our guess: ${aiGuess === "yes" ? "Yes" : "No"}${
              confidence != null ? ` (${Math.round(confidence * 100)}% sure)` : ""
            }${decision ? (aiGuess === decision ? ". You agreed." : ". You decided differently.") : "."}`
          : null;

  return (
    <section aria-labelledby="their-answer" className="space-y-2 px-1">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="their-answer" className="flex items-center gap-2 text-base font-semibold">
          {step != null && <StepNumber n={step} />}
          Their answer
        </h2>
        <div role="group" aria-labelledby="their-answer" className="inline-flex rounded-lg border bg-card p-0.5">
          {CHOICES.map((c) => {
            const active = decision === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                aria-keyshortcuts={c.key}
                disabled={deciding || active}
                onClick={() => onDecide(c.value)}
                className={`rounded-md px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${
                  active
                    ? "bg-foreground font-medium text-background"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground disabled:opacity-60"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {decision && <span className="text-sm text-muted-foreground">Now: {decisionStatusLabel(decision)}</span>}
      </div>
      <p className="text-sm text-muted-foreground" aria-hidden="true">
        Shortcuts: Y yes, L not right now, N no, J next reply
      </p>
      {after}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
