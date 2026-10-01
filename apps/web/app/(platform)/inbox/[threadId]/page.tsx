"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guessFromIntent } from "@/lib/inbox/decision";

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
    replyDecision: "yes" | "no" | "later" | null;
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
const DEFAULT_FOLLOW_UP = `Yay! Can't wait for you to try it. Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK}

I'll let you know when it ships.`;

export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState(DEFAULT_FOLLOW_UP);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [replySending, setReplySending] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [replyNotice, setReplyNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [threadRes, brandRes] = await Promise.all([
          fetch(`/api/inbox/${params.threadId}`),
          fetch("/api/brands/current"),
        ]);

        if (threadRes.ok) {
          const loaded = (await threadRes.json()) as Thread;
          setThread(loaded);
          const suggestion = loaded.campaignCreator.aiDrafts.find(
            (d) => d.type === "reply" && d.status === "draft"
          );
          if (suggestion) {
            setReplyText(suggestion.body);
            setSuggestionId(suggestion.id);
          }
        }
        if (brandRes.ok) {
          setBrand((await brandRes.json()) as BrandData);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.threadId]);

  async function reloadThread() {
    const res = await fetch(`/api/inbox/${params.threadId}`);
    if (res.ok) setThread((await res.json()) as Thread);
  }

  async function handleDecision(decision: "yes" | "no" | "later") {
    if (decision === "no" && !confirm("Mark as no? They'll go on the do-not-send list and won't be emailed again.")) return;
    setDeciding(true);
    try {
      const res = await fetch(`/api/inbox/${params.threadId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setReplyNotice({ tone: "error", text: data.error ?? "Could not save your decision" });
        return;
      }
      await reloadThread();
    } finally {
      setDeciding(false);
    }
  }

  async function handleSendReply() {
    if (!replyText.trim()) return;
    if (!confirm("Send this reply?")) return;
    setReplySending(true);
    setReplyNotice(null);
    try {
      const res = await fetch(`/api/inbox/${params.threadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText, draftId: suggestionId ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setReplyNotice({ tone: "error", text: data.error ?? "Reply failed to send" });
        return;
      }
      setReplyNotice({
        tone: "success",
        text: replyText.includes(ADDRESS_LINK)
          ? "Reply sent with their private address link."
          : "Reply sent.",
      });
      setReplyText("");
      setSuggestionId(null);
      await reloadThread();
    } catch {
      setReplyNotice({ tone: "error", text: "Reply failed to send" });
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
      const res = await fetch(`/api/inbox/${params.threadId}/send-dm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: dmText.trim() }),
      });

      if (res.ok) {
        setDmText("");
        // Refresh thread
        const threadRes = await fetch(`/api/inbox/${params.threadId}`);
        if (threadRes.ok) {
          setThread((await threadRes.json()) as Thread);
        }
      } else {
        const data = await res.json();
        setDmError(data.error || "Failed to send DM");
      }
    } catch {
      setDmError("Network error sending DM");
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
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
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
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading thread...</p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Thread not found</h1>
        <Button variant="outline" onClick={() => router.push("/inbox")}>
          ← Back to Inbox
        </Button>
      </div>
    );
  }

  const creator = thread.campaignCreator.creator;
  const profile = creator.profiles[0];
  const pendingAddresses = thread.campaignCreator.shippingSnapshots.filter(
    (s) => !s.confirmedAt && !s.isActive
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              <Link href={`/creators/${creator.id}`} className="hover:underline">
                {creator.name ?? profile?.handle ?? "Unknown Creator"}
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
        <Button variant="outline" onClick={() => router.push("/inbox")}>
          Back to inbox
        </Button>
      </div>

      {/* Reply decision: operator's official call, AI guess shown alongside */}
      {thread.messages.some((m) => m.direction === "inbound") && (() => {
        const latestInbound = [...thread.messages].reverse().find((m) => m.direction === "inbound");
        const aiGuess = guessFromIntent(latestInbound?.classification);
        const decision = thread.campaignCreator.replyDecision;
        return (
          <Card
            className={
              decision === "yes"
                ? "border-green-200 bg-green-50"
                : decision === "no"
                  ? "border-red-200 bg-red-50"
                  : decision === "later"
                    ? "border-slate-200 bg-slate-50"
                    : "border-amber-200 bg-amber-50"
            }
          >
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <p className="font-medium">
                  {decision === "yes"
                    ? "They said yes"
                    : decision === "no"
                      ? "They said no. They're on the do-not-send list."
                      : decision === "later"
                        ? "Not right now. They're not on the do-not-send list."
                        : "Did they say yes?"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {aiGuess && aiGuess !== "unclear"
                    ? `The AI thinks this is a ${aiGuess}${
                        latestInbound?.confidence != null ? ` (${Math.round(latestInbound.confidence * 100)}% sure)` : ""
                      }.${decision ? (aiGuess === decision ? " You agreed." : " You decided differently.") : ""} You can change this anytime.`
                    : "Pick one. You can change it anytime."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={decision === "yes" ? "default" : "outline"}
                  disabled={deciding || decision === "yes"}
                  onClick={() => void handleDecision("yes")}
                >
                  They said yes
                </Button>
                <Button
                  size="sm"
                  variant={decision === "later" ? "secondary" : "outline"}
                  disabled={deciding || decision === "later"}
                  onClick={() => void handleDecision("later")}
                >
                  Not right now
                </Button>
                <Button
                  size="sm"
                  variant={decision === "no" ? "destructive" : "outline"}
                  disabled={deciding || decision === "no"}
                  onClick={() => void handleDecision("no")}
                >
                  They said no
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Pending Address Snapshot */}
      {pendingAddresses.length > 0 && (
        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <CardTitle className="text-base text-teal-900">
              Address to review
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

      {/* Email reply */}
      {thread.channel === "email" && thread.campaignCreator.replyDecision !== "no" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {suggestionId ? "Reply · suggested answer (edit before sending)" : "Reply"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {replyNotice && (
              <div
                className={`rounded border p-2 text-sm ${
                  replyNotice.tone === "success"
                    ? "border-green-200 bg-green-50 text-green-900"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {replyNotice.text}
              </div>
            )}
            <textarea
              className="w-full min-h-40 rounded-md border p-3 text-sm leading-relaxed"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply…"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {replyText.includes(ADDRESS_LINK)
                  ? `${ADDRESS_LINK} becomes their private link to add a shipping address.`
                  : `To: ${creator.email ?? "no email on file"}`}
              </p>
              <div className="flex gap-2">
                {!replyText.includes(ADDRESS_LINK) && (
                  <Button size="sm" variant="outline" onClick={() => setReplyText(DEFAULT_FOLLOW_UP)}>
                    Use address-link message
                  </Button>
                )}
                <Button size="sm" onClick={handleSendReply} disabled={replySending || !replyText.trim()}>
                  {replySending ? "Sending…" : "Send reply"}
                </Button>
              </div>
            </div>
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
              <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                {dmError}
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

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          {thread.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages in this thread yet.
            </p>
          ) : (
            <div className="space-y-4">
              {thread.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 ${
                    msg.direction === "inbound"
                      ? "bg-muted/50"
                      : "bg-blue-50 ml-8"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">
                      {msg.direction === "inbound" ? "↙ Reply" : "↗ You sent"}
                    </span>
                    {msg.fromAddress && <span>from {msg.fromAddress}</span>}
                    <span>
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>

                  </div>
                  {msg.subject && (
                    <p className="mb-1 text-sm font-medium">{msg.subject}</p>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
