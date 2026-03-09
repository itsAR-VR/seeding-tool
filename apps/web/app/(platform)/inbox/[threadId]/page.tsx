"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    creator: {
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

export default function ThreadDetailPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<Thread | null>(null);
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendLoading, setSendLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [threadRes, brandRes] = await Promise.all([
          fetch(`/api/inbox/${params.threadId}`),
          fetch("/api/brands/current"),
        ]);

        if (threadRes.ok) {
          setThread((await threadRes.json()) as Thread);
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

  async function handleSendDraft(draftId: string) {
    const primaryAlias =
      brand?.emailAliases?.find((alias) => alias.isPrimary) ??
      brand?.emailAliases?.[0];

    if (!primaryAlias) return;

    setSendLoading(true);
    try {
      // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
      const res = await fetch(`/api/inbox/${params.threadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          aliasId: primaryAlias.id,
        }),
      });

      if (res.ok) {
        // Refresh thread data
        const threadRes = await fetch(`/api/inbox/${params.threadId}`);
        if (threadRes.ok) {
          setThread((await threadRes.json()) as Thread);
        }
      }
    } catch {
      // ignore
    } finally {
      setSendLoading(false);
    }
  }

  async function handleDiscardDraft(draftId: string) {
    try {
      await fetch(`/api/inbox/${params.threadId}/drafts/${draftId}`, {
        method: "DELETE",
      });
      // Refresh
      const threadRes = await fetch(`/api/inbox/${params.threadId}`);
      if (threadRes.ok) {
        setThread((await threadRes.json()) as Thread);
      }
    } catch {
      // ignore
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
  const pendingDrafts = thread.campaignCreator.aiDrafts.filter(
    (d) => d.status === "draft"
  );
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
              {creator.name ?? profile?.handle ?? "Unknown Creator"}
            </h1>
            <Badge>{thread.status}</Badge>
            <Badge variant="outline">
              {thread.channel === "instagram_dm" ? "📱 DM" : "📧 Email"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {thread.campaignCreator.campaign.name}
            {profile && ` · @${profile.handle}`}
            {profile?.followerCount != null &&
              ` · ${profile.followerCount.toLocaleString()} followers`}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/inbox")}>
          ← Back
        </Button>
      </div>

      {/* Pending Address Snapshot */}
      {pendingAddresses.length > 0 && (
        <Card className="border-teal-200 bg-teal-50">
          <CardHeader>
            <CardTitle className="text-base text-teal-900">
              📦 Extracted Address — Review Required
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
                <p className="text-xs text-muted-foreground">
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

      {/* Pending AI Drafts */}
      {pendingDrafts.map((draft) => (
        <Card key={draft.id} className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-base text-purple-900">
              ✨ AI Draft — Review Before Sending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.subject && (
              <p className="text-sm font-medium">
                Subject: {draft.subject}
              </p>
            )}
            {editingDraft === draft.id ? (
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-32 rounded-md border p-3 text-sm"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      // Save edit (in a real implementation, PATCH the draft)
                      setEditingDraft(null);
                    }}
                  >
                    Save Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingDraft(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="whitespace-pre-wrap rounded-md bg-white p-3 text-sm">
                  {draft.body}
                </div>
                <div className="flex gap-2">
                  {/* INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action. */}
                  <Button
                    size="sm"
                    onClick={() => handleSendDraft(draft.id)}
                    disabled={sendLoading}
                  >
                    {sendLoading ? "Sending..." : "Send"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDraft(draft.id);
                      setDraftText(draft.body);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleDiscardDraft(draft.id)}
                  >
                    Discard
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* DM Compose — shown for instagram_dm threads or creators with Instagram handle */}
      {(thread.channel === "instagram_dm" || creator.instagramHandle) && (
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
              <p className="text-xs text-muted-foreground">
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
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">
                      {msg.direction === "inbound" ? "↙ Inbound" : "↗ Sent"}
                    </span>
                    {msg.fromAddress && <span>from {msg.fromAddress}</span>}
                    <span>
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                    {msg.classification && (
                      <Badge variant="outline" className="text-xs">
                        {msg.classification}
                        {msg.confidence != null &&
                          ` (${(msg.confidence * 100).toFixed(0)}%)`}
                      </Badge>
                    )}
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
