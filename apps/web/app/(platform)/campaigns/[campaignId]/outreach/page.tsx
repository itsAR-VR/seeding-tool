"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BUILT_IN_PERSONAS } from "@/lib/ai/personas";

type CampaignCreator = {
  id: string;
  reviewStatus: string;
  lifecycleStatus: string;
  creator: {
    id: string;
    name: string | null;
    instagramHandle: string | null;
    email: string | null;
    followerCount: number | null;
    bio: string | null;
  };
};

type Notice = { tone: "success" | "error"; text: string };

const STATUS_LABELS: Record<string, string> = {
  ready: "Not contacted",
  outreach_sent: "Emailed",
  replied: "Replied",
  address_review: "Address to review",
  address_confirmed: "Address confirmed",
  order_created: "Order drafted",
  shipped: "Shipped",
  delivered: "Delivered",
  posted: "Posted",
  completed: "Completed",
  opted_out: "Opted out",
  stalled: "Stalled",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

type CustomPersona = {
  id: string;
  name: string;
  tone: string;
};

type GeneratedDraft = {
  campaignCreatorId: string;
  creatorId: string;
  creatorHandle: string;
  creatorName: string | null;
  subject: string | null;
  body: string | null;
  tokens: number;
  error: string | null;
};

type SenderOption = {
  id: string;
  address: string;
  isPrimary: boolean;
  isPaused: boolean;
};

type CampaignSetup = {
  campaignProducts?: Array<{ id: string }>;
  senderAliasId?: string | null;
  senderOptions?: SenderOption[];
};

const DEFAULT_SENDER = "__primary";

type ConnectionsOverview = {
  providers: Array<{
    provider: "gmail" | "instagram" | "shopify" | "unipile";
    connected: boolean;
  }>;
};

export default function OutreachPage() {
  const { campaignId } = useParams<{ campaignId: string }>();

  const [creators, setCreators] = useState<CampaignCreator[]>([]);
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [personaId, setPersonaId] = useState("builtin-professional");
  const [channel, setChannel] = useState<"email" | "instagram_dm">("email");
  const [additionalContext, setAdditionalContext] = useState("");
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [editedDrafts, setEditedDrafts] = useState<
    Record<string, { subject?: string; body: string }>
  >({});
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [campaignSetup, setCampaignSetup] = useState<CampaignSetup | null>(null);
  const [connections, setConnections] = useState<ConnectionsOverview | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const [senderError, setSenderError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Load campaign creators
  const loadCreators = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creators`);
      if (res.ok) {
        const data = await res.json();
        // data might be array or { creators: [...] }
        const list = Array.isArray(data) ? data : data.creators ?? [];
        setCreators(list);
      }
    } catch (err) {
      console.error("Failed to load creators:", err);
    } finally {
      setLoadingCreators(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadCreators();
  }, [loadCreators]);

  // Load custom personas
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/ai-personas");
        if (res.ok) {
          const data = await res.json();
          setCustomPersonas(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load personas:", err);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadSetup() {
      try {
        const [campaignRes, connectionsRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}`),
          fetch("/api/connections/overview"),
        ]);

        if (campaignRes.ok) {
          setCampaignSetup((await campaignRes.json()) as CampaignSetup);
        }

        if (connectionsRes.ok) {
          setConnections((await connectionsRes.json()) as ConnectionsOverview);
        }
      } catch (err) {
        console.error("Failed to load outreach setup:", err);
      } finally {
        setSetupLoading(false);
      }
    }

    loadSetup();
  }, [campaignId]);

  async function handleSenderChange(value: string) {
    const senderAliasId = value === DEFAULT_SENDER ? null : value;
    setSavingSender(true);
    setSenderError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderAliasId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSenderError(data?.error ?? "Could not save the sender.");
        return;
      }
      setCampaignSetup((current) =>
        current ? { ...current, senderAliasId } : current
      );
    } catch {
      setSenderError("Could not save the sender.");
    } finally {
      setSavingSender(false);
    }
  }

  const MAX_BATCH_SIZE = 20;

  // Derive approved list here so all handlers below have access
  const approvedCreators = creators.filter(
    (c) => c.reviewStatus === "approved"
  );
  // Only creators who have not been contacted can be drafted and sent.
  const sendableCreators = approvedCreators.filter(
    (c) => c.lifecycleStatus === "ready"
  );
  const creatorByCcId = new Map(creators.map((c) => [c.id, c]));
  const senderAddress =
    (campaignSetup?.senderAliasId
      ? campaignSetup.senderOptions?.find((o) => o.id === campaignSetup.senderAliasId)?.address
      : campaignSetup?.senderOptions?.find((o) => o.isPrimary)?.address) ?? null;
  const hasProducts = Boolean(campaignSetup?.campaignProducts?.length);
  const hasGmail =
    connections?.providers.some(
      (provider) => provider.provider === "gmail" && provider.connected
    ) ?? false;
  const hasUnipile =
    connections?.providers.some(
      (provider) => provider.provider === "unipile" && provider.connected
    ) ?? false;
  const selectedChannelConnected = channel === "email" ? hasGmail : hasUnipile;
  const draftBlocker = !hasProducts
    ? "Attach at least one campaign product before drafting outreach."
    : null;
  const sendBlocker = !hasProducts
    ? "Attach at least one campaign product before sending outreach."
    : !selectedChannelConnected
      ? channel === "email"
        ? "Connect Gmail in Settings → Connections before sending emails."
        : "Connect Unipile in Settings → Connections before sending Instagram DMs."
      : null;

  const toggleCreator = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const batch = sendableCreators.slice(0, MAX_BATCH_SIZE);
    const allBatchSelected = batch.length > 0 && batch.every((c) => selectedIds.has(c.id));
    if (allBatchSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(batch.map((c) => c.id)));
    }
  };

  const generateDrafts = async () => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size > MAX_BATCH_SIZE) {
      alert(`Please select ${MAX_BATCH_SIZE} or fewer creators per batch. You have ${selectedIds.size} selected.`);
      return;
    }
    setGenerating(true);
    setNotice(null);
    setDrafts([]);
    setEditedDrafts({});

    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignCreatorIds: Array.from(selectedIds),
          personaId,
          channel,
          additionalContext: additionalContext || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts);
        // Initialize editable copies
        const edits: Record<string, { subject?: string; body: string }> = {};
        for (const d of data.drafts) {
          if (d.body) {
            edits[d.campaignCreatorId] = {
              subject: d.subject ?? undefined,
              body: d.body,
            };
          }
        }
        setEditedDrafts(edits);
        window.setTimeout(() => {
          document.getElementById("review-emails")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      } else {
        const err = await res.json().catch(() => null);
        console.error("Draft generation failed:", err);
        setNotice({ tone: "error", text: err?.error ?? "Couldn't load drafts. Try again." });
      }
    } catch (err) {
      console.error("Draft generation error:", err);
      setNotice({ tone: "error", text: "Couldn't load drafts. Try again." });
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (
    ccId: string,
    field: "subject" | "body",
    value: string
  ) => {
    setEditedDrafts((prev) => ({
      ...prev,
      [ccId]: { ...prev[ccId]!, [field]: value },
    }));
  };

  type SendResponse = {
    sent?: number;
    failed?: number;
    noContact?: number;
    error?: string;
    results?: Array<{ campaignCreatorId: string; status: string; error?: string }>;
  };

  // Show the outcome inline, drop sent drafts, and refresh creator statuses.
  const handleSendResult = async (data: SendResponse, ok: boolean) => {
    if (!ok) {
      setNotice({ tone: "error", text: data.error || "Send failed. Nothing was sent." });
      return;
    }
    const sentIds = new Set(
      (data.results ?? []).filter((r) => r.status === "sent").map((r) => r.campaignCreatorId)
    );
    const failures = (data.results ?? []).filter((r) => r.status !== "sent");
    setDrafts((prev) => prev.filter((d) => !sentIds.has(d.campaignCreatorId)));
    setSelectedIds((prev) => new Set([...prev].filter((id) => !sentIds.has(id))));
    const sent = data.sent ?? sentIds.size;
    setNotice(
      failures.length === 0
        ? { tone: "success", text: `Sent ${sent} email${sent === 1 ? "" : "s"}${senderAddress ? ` from ${senderAddress}` : ""}.` }
        : {
            tone: "error",
            text: `Sent ${sent}, ${failures.length} not sent: ${failures[0]?.error ?? "unknown error"}`,
          }
    );
    await loadCreators();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outreach</h1>
        <p className="text-muted-foreground">
          Review and send emails to approved creators.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <span>{notice.tone === "success" ? "✓ " : ""}{notice.text}</span>
          <button
            type="button"
            className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {!setupLoading && !draftBlocker && !sendBlocker ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <span className="font-medium">Ready to send</span>
          <span>✓ {campaignSetup?.campaignProducts?.length ?? 0} product</span>
          <span>✓ {sendableCreators.length} not yet contacted</span>
          <span>
            ✓ {channel === "email" ? `Gmail${senderAddress ? ` · ${senderAddress}` : ""}` : "Instagram DMs"}
          </span>
        </div>
      ) : (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle>Finish setup before sending</CardTitle>
          <CardDescription>
            Each campaign needs a product, and the channel you send on has to be connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Products",
                ready: hasProducts,
                helper: hasProducts
                  ? `${campaignSetup?.campaignProducts?.length ?? 0} attached`
                  : "Missing",
              },
              {
                label: "Approved creators",
                ready: approvedCreators.length > 0,
                helper:
                  approvedCreators.length > 0
                    ? `${approvedCreators.length} ready`
                    : "None approved yet",
              },
              {
                label: "Gmail",
                ready: hasGmail,
                helper: hasGmail ? "Email sending ready" : "Not connected",
              },
              ...(channel === "instagram_dm"
                ? [
                    {
                      label: "Instagram DMs",
                      ready: hasUnipile,
                      helper: hasUnipile ? "DM sending ready" : "Not connected",
                    },
                  ]
                : []),
            ].map((item) => (
              <div key={item.label} className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant={item.ready ? "default" : "secondary"}>
                    {item.ready ? "Ready" : "Needs setup"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.helper}</p>
              </div>
            ))}
          </div>

          {setupLoading ? (
            <p className="text-sm text-muted-foreground">Checking current setup…</p>
          ) : draftBlocker || sendBlocker ? (
            <div className="flex flex-wrap gap-2">
              {!hasProducts ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/campaigns/${campaignId}/products`;
                  }}
                >
                  Add products
                </Button>
              ) : null}
              {!selectedChannelConnected ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/settings/connections";
                  }}
                >
                  Open connections
                </Button>
              ) : null}
            </div>
          ) : (
            null
          )}
        </CardContent>
      </Card>
      )}

      {/* Creator Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Choose creators</CardTitle>
              <CardDescription>
                {loadingCreators
                  ? "Loading..."
                  : `Click the creators you want to email. ${sendableCreators.length} of ${approvedCreators.length} haven't been contacted yet.`}
              </CardDescription>
            </div>
            {sendableCreators.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === sendableCreators.slice(0, MAX_BATCH_SIZE).length &&
                  sendableCreators.slice(0, MAX_BATCH_SIZE).every((c) => selectedIds.has(c.id))
                  ? "Deselect All"
                  : `Select All (up to ${MAX_BATCH_SIZE})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingCreators ? (
            <p className="text-sm text-muted-foreground">
              Loading creators...
            </p>
          ) : approvedCreators.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved creators in this campaign yet.
            </p>
          ) : (
            <div className="space-y-2">
              {approvedCreators.map((cc) => {
                const sendable = cc.lifecycleStatus === "ready";
                return (
                <div
                  key={cc.id}
                  role="checkbox"
                  aria-checked={selectedIds.has(cc.id)}
                  aria-disabled={!sendable}
                  tabIndex={sendable ? 0 : -1}
                  onClick={() => sendable && toggleCreator(cc.id)}
                  onKeyDown={(e) => {
                    if (sendable && (e.key === " " || e.key === "Enter")) {
                      e.preventDefault();
                      toggleCreator(cc.id);
                    }
                  }}
                  className={`flex select-none items-center gap-3 rounded-lg border p-3 transition-colors ${
                    !sendable
                      ? "cursor-not-allowed bg-muted/40 opacity-70"
                      : selectedIds.has(cc.id)
                        ? "cursor-pointer border-foreground/40 bg-accent"
                        : "cursor-pointer hover:bg-accent/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(cc.id)}
                    disabled={!sendable}
                    className="pointer-events-none"
                    tabIndex={-1}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {cc.creator.name ??
                          cc.creator.instagramHandle ??
                          "Unknown"}
                      </span>
                      {cc.creator.instagramHandle && (
                        <span className="text-sm text-muted-foreground">
                          @{cc.creator.instagramHandle}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {[
                        cc.creator.email,
                        cc.creator.followerCount
                          ? `${cc.creator.followerCount.toLocaleString()} followers`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <Badge
                    variant={sendable ? "outline" : "secondary"}
                    className="text-xs"
                  >
                    {statusLabel(cc.lifecycleStatus)}
                  </Badge>
                </div>
                );
              })}
            </div>
          )}

          <div className="sticky bottom-4 mt-4 flex items-center justify-end gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
            <span className="mr-auto text-sm text-muted-foreground">
              {selectedIds.size === 0
                ? "Click a creator to select them"
                : `${selectedIds.size} selected`}
            </span>
            {draftBlocker ? (
              <span className="text-sm font-medium text-amber-700">
                {draftBlocker}
              </span>
            ) : null}
            {selectedIds.size > MAX_BATCH_SIZE && (
              <span className="text-sm text-red-500 font-medium">
                Max {MAX_BATCH_SIZE} per batch — deselect {selectedIds.size - MAX_BATCH_SIZE} creator{selectedIds.size - MAX_BATCH_SIZE !== 1 ? "s" : ""}
              </span>
            )}
            <Button
              size="lg"
              onClick={generateDrafts}
              disabled={Boolean(draftBlocker) || selectedIds.size === 0 || generating || selectedIds.size > MAX_BATCH_SIZE}
            >
              {generating
                ? "Loading drafts..."
                : `Load drafts (${selectedIds.size})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <details className="group rounded-xl border bg-card">
        <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground">
          <span className="group-open:hidden">▸</span>
          <span className="hidden group-open:inline">▾</span> More options: sender, channel, AI writing
        </summary>
        <div className="space-y-4 px-6 pb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>AI writing style</Label>
              <Select value={personaId} onValueChange={(v) => v && setPersonaId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a style">
                    {(value: string | null) =>
                      BUILT_IN_PERSONAS.find((p) => p.id === value)?.name ??
                      customPersonas.find((p) => p.id === value)?.name ??
                      "Select a style"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {/* Built-in personas */}
                  <SelectItem
                    disabled
                    value="__header_builtin"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Built-in
                  </SelectItem>
                  {BUILT_IN_PERSONAS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {/* Custom personas */}
                  {customPersonas.length > 0 && (
                    <>
                      <SelectItem
                        disabled
                        value="__header_custom"
                        className="text-xs font-semibold text-muted-foreground"
                      >
                        Custom
                      </SelectItem>
                      {customPersonas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) =>
                  setChannel(v as "email" | "instagram_dm")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(value: string | null) => (value === "instagram_dm" ? "Instagram DM" : "Email")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="instagram_dm">
                    💬 Instagram DM
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {channel === "email" && (campaignSetup?.senderOptions?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <Label>Send from</Label>
                <Select
                  value={campaignSetup?.senderAliasId ?? DEFAULT_SENDER}
                  onValueChange={(v) => void handleSenderChange(v ?? DEFAULT_SENDER)}
                  disabled={savingSender}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string | null) =>
                        value && value !== DEFAULT_SENDER
                          ? campaignSetup?.senderOptions?.find((o) => o.id === value)?.address ?? value
                          : `Default (${campaignSetup?.senderOptions?.find((o) => o.isPrimary)?.address ?? "primary Gmail"})`
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_SENDER}>
                      Default (
                      {campaignSetup?.senderOptions?.find((o) => o.isPrimary)?.address ??
                        "primary Gmail"}
                      )
                    </SelectItem>
                    {campaignSetup?.senderOptions?.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                        disabled={option.isPaused}
                      >
                        {option.address}
                        {option.isPaused ? " (paused)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {senderError && (
                  <p className="text-sm text-red-600">{senderError}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>AI instructions</Label>
            <p className="text-xs text-muted-foreground">
              Only used for creators who don&apos;t already have a written email.
            </p>
            <Textarea
              placeholder="Talking points or instructions for the AI..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </details>

      {/* Generated Drafts */}
      {drafts.length > 0 && (
        <Card id="review-emails">
          <CardHeader>
            <CardTitle>Review emails</CardTitle>
            <CardDescription>
              Edit anything you like. Nothing sends until you click Send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {drafts.map((draft) => (
              <div
                key={draft.campaignCreatorId}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <div>
                      <span className="font-medium">
                        {draft.creatorName ?? draft.creatorHandle}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        @{draft.creatorHandle}
                      </span>
                    </div>
                    {channel === "email" && (
                      <p className="text-xs text-muted-foreground">
                        {senderAddress ? `From ${senderAddress} · ` : ""}To{" "}
                        {creatorByCcId.get(draft.campaignCreatorId)?.creator.email ?? "no email on file"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!draft.error && draft.body && (
                      <Button
                        size="sm"
                        disabled={sending || Boolean(sendBlocker)}
                        onClick={async () => {
                          const confirmed = confirm(
                            `Send ${channel === "email" ? "email" : "DM"} to @${draft.creatorHandle}?`
                          );
                          if (!confirmed) return;
                          setSending(true);
                          try {
                            const res = await fetch("/api/outreach/send", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                drafts: [
                                  {
                                    campaignCreatorId:
                                      draft.campaignCreatorId,
                                    creatorId: draft.creatorId,
                                    channel,
                                    subject:
                                      editedDrafts[draft.campaignCreatorId]
                                        ?.subject ??
                                      draft.subject ??
                                      undefined,
                                    body:
                                      editedDrafts[draft.campaignCreatorId]
                                        ?.body ?? draft.body!,
                                  },
                                ],
                              }),
                            });
                            const data = (await res.json().catch(() => ({}))) as SendResponse;
                            await handleSendResult(data, res.ok);
                          } catch {
                            setNotice({ tone: "error", text: "Send failed. Nothing was sent." });
                          } finally {
                            setSending(false);
                          }
                        }}
                      >
                        Send
                      </Button>
                    )}
                  </div>
                </div>

                {draft.error ? (
                  <p className="text-sm text-red-500">{draft.error}</p>
                ) : (
                  <>
                    {channel === "email" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Subject</Label>
                        <input
                          type="text"
                          className="w-full rounded-md border px-3 py-2 text-sm"
                          value={
                            editedDrafts[draft.campaignCreatorId]?.subject ?? ""
                          }
                          onChange={(e) =>
                            updateDraft(
                              draft.campaignCreatorId,
                              "subject",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {channel === "email" ? "Body" : "Message"}
                      </Label>
                      <Textarea
                        value={
                          editedDrafts[draft.campaignCreatorId]?.body ?? ""
                        }
                        onChange={(e) =>
                          updateDraft(
                            draft.campaignCreatorId,
                            "body",
                            e.target.value
                          )
                        }
                        rows={channel === "instagram_dm" ? 3 : 9}
                        className="leading-relaxed"
                      />
                    </div>
                    {sendBlocker ? (
                      <p className="text-xs font-medium text-amber-700">
                        {sendBlocker}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t">
              {sendBlocker ? (
                <p className="mr-auto text-sm font-medium text-amber-700">
                  {sendBlocker}
                </p>
              ) : null}
              <Button
                variant="outline"
                onClick={() => {
                  setDrafts([]);
                  setEditedDrafts({});
                }}
              >
                Discard
              </Button>
              <Button
                disabled={
                  Boolean(sendBlocker) ||
                  sending ||
                  drafts.filter((d) => !d.error).length === 0
                }
                onClick={async () => {
                  const validDrafts = drafts.filter(
                    (d) => !d.error && d.body
                  );
                  if (validDrafts.length === 0) return;

                  const confirmed = confirm(
                    `Send ${validDrafts.length} ${channel === "email" ? "email(s)" : "DM(s)"}? This action cannot be undone.`
                  );
                  if (!confirmed) return;

                  setSending(true);
                  setSendProgress(`Sending 0/${validDrafts.length}...`);

                  try {
                    const payload = validDrafts.map((d) => ({
                      campaignCreatorId: d.campaignCreatorId,
                      creatorId: d.creatorId,
                      channel,
                      subject:
                        editedDrafts[d.campaignCreatorId]?.subject ??
                        d.subject ??
                        undefined,
                      body:
                        editedDrafts[d.campaignCreatorId]?.body ?? d.body!,
                    }));

                    const res = await fetch("/api/outreach/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ drafts: payload }),
                    });

                    const data = (await res.json().catch(() => ({}))) as SendResponse;
                    setSendProgress("");
                    await handleSendResult(data, res.ok);
                  } catch {
                    setNotice({ tone: "error", text: "Send failed. Nothing was sent." });
                  } finally {
                    setSending(false);
                    setSendProgress("");
                  }
                }}
              >
                {sending
                  ? sendProgress || "Sending..."
                  : `Send all (${drafts.filter((d) => !d.error).length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
