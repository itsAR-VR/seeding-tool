"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
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
  ready: "Not emailed yet",
  outreach_sent: "Emailed",
  replied: "Replied",
  address_review: "Address to check",
  address_confirmed: "Address in",
  order_created: "Order made",
  shipped: "Shipped",
  delivered: "Delivered",
  posted: "Posted",
  completed: "Done",
  opted_out: "Said no",
  stalled: "Not right now",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "In progress";
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
  const searchParams = useSearchParams();
  const preselectId = searchParams.get("select");

  const [creators, setCreators] = useState<CampaignCreator[]>([]);
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [personaId, setPersonaId] = useState("builtin-professional");
  const [channel, setChannel] = useState<"email" | "instagram_dm">("email");
  const [additionalContext, setAdditionalContext] = useState("");
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  // Two separate screens: pick creators, then review and send their emails.
  const [step, setStep] = useState<"choose" | "review">("choose");
  const [editedDrafts, setEditedDrafts] = useState<
    Record<string, { subject?: string; body: string }>
  >({});
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [campaignSetup, setCampaignSetup] = useState<CampaignSetup | null>(null);
  const [connections, setConnections] = useState<ConnectionsOverview | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  // Which send is running: one creator's id, or "all". Only that button shows progress.
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const sending = sendingIds.size > 0;
  const startSending = (id: string) => setSendingIds((cur) => new Set(cur).add(id));
  const stopSending = (id: string) =>
    setSendingIds((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  const [sendProgress, setSendProgress] = useState("");
  const [savingSender, setSavingSender] = useState(false);
  const [senderError, setSenderError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Which send is waiting for a second click: "all", or one campaignCreatorId.
  const [confirmingSend, setConfirmingSend] = useState<string | null>(null);

  // Load campaign creators
  const loadCreators = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creators`);
      if (res.ok) {
        const data = await res.json();
        // data might be array or { creators: [...] }
        const list = Array.isArray(data) ? data : data.creators ?? [];
        setCreators(list);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice({ tone: "error", text: data?.error ?? "Couldn't load this campaign's creators. Refresh the page." });
      }
    } catch (err) {
      console.error("Failed to load creators:", err);
      setNotice({ tone: "error", text: "Couldn't load this campaign's creators. Check your connection and refresh." });
    } finally {
      setLoadingCreators(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadCreators();
  }, [loadCreators]);

  // Arriving from a creator's "Email →" link pre-selects that creator.
  useEffect(() => {
    if (!preselectId) return;
    const target = creators.find((c) => c.id === preselectId);
    if (target && target.reviewStatus === "approved" && target.lifecycleStatus === "ready") {
      setSelectedIds((prev) => (prev.has(preselectId) ? prev : new Set([...prev, preselectId])));
    }
  }, [preselectId, creators]);

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
        ? "Connect Gmail in Settings > Connections before sending emails."
        : "Connect Instagram messages in Settings > Connections before sending DMs."
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
      setNotice({
        tone: "error",
        text: `You can email up to ${MAX_BATCH_SIZE} creators at a time. You picked ${selectedIds.size}, so unselect a few.`,
      });
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
        setStep("review");
        window.scrollTo({ top: 0 });
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
      [ccId]: { ...(prev[ccId] ?? { body: "" }), [field]: value },
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
    setDrafts((prev) => {
        const left = prev.filter((d) => !sentIds.has(d.campaignCreatorId));
        if (left.length === 0) setStep("choose");
        return left;
      });
    setSelectedIds((prev) => new Set([...prev].filter((id) => !sentIds.has(id))));
    const sent = data.sent ?? sentIds.size;
    setNotice(
      failures.length === 0
        ? { tone: "success", text: `Sent ${sent} email${sent === 1 ? "" : "s"}${senderAddress ? ` from ${senderAddress}` : ""}.` }
        : {
            tone: "error",
            text: `Sent ${sent}, ${failures.length} not sent: ${failures[0]?.error ?? "we didn't get a reason"}`,
          }
    );
    await loadCreators();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email creators</h1>
        <ol className="mt-3 flex flex-wrap items-center gap-3 text-sm" aria-label="Steps">
          <li className={step === "choose" ? "font-semibold" : "text-muted-foreground"} aria-current={step === "choose" ? "step" : undefined}>
            1. Choose creators
          </li>
          <li aria-hidden className="text-muted-foreground">→</li>
          <li className={step === "review" ? "font-semibold" : "text-muted-foreground"} aria-current={step === "review" ? "step" : undefined}>
            2. Review and send
          </li>
        </ol>
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
            className="text-sm underline underline-offset-2 opacity-80 hover:opacity-100"
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
                  {channel === "email" ? "Connect Gmail" : "Connect Instagram messages"}
                </Button>
              ) : null}
            </div>
          ) : (
            null
          )}
        </CardContent>
      </Card>
      )}

      {step === "choose" && drafts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <span>
            {drafts.length} {drafts.length === 1 ? "email is" : "emails are"} written and waiting for you.
          </span>
          <Button onClick={() => setStep("review")}>Back to review and send</Button>
        </div>
      )}

      {step === "choose" && (
      <>
      {/* Creator Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Choose creators</CardTitle>
              <CardDescription>
                {loadingCreators
                  ? "Loading…"
                  : `Click the creators you want to email. ${sendableCreators.length} of ${approvedCreators.length} haven't been emailed yet.`}
              </CardDescription>
            </div>
            {sendableCreators.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === sendableCreators.slice(0, MAX_BATCH_SIZE).length &&
                  sendableCreators.slice(0, MAX_BATCH_SIZE).every((c) => selectedIds.has(c.id))
                  ? "Unselect all"
                  : `Select the first ${MAX_BATCH_SIZE}`}
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No approved creators in this campaign yet. Add creators, then approve the ones you
                want to email.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/campaigns/${campaignId}/review`} className={buttonVariants({ size: "sm" })}>
                  Review creators
                </Link>
                <Link
                  href={`/campaigns/${campaignId}/discover`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Find creators
                </Link>
              </div>
            </div>
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
                          "Unnamed creator"}
                      </span>
                      {cc.creator.instagramHandle && (
                        <span className="text-sm text-muted-foreground">
                          @{cc.creator.instagramHandle}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
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
                    className="text-sm"
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
              <span className="text-sm font-medium text-red-700">
                Up to {MAX_BATCH_SIZE} at a time. Unselect {selectedIds.size - MAX_BATCH_SIZE} creator{selectedIds.size - MAX_BATCH_SIZE !== 1 ? "s" : ""}.
              </span>
            )}
            <Button
              size="lg"
              onClick={generateDrafts}
              disabled={Boolean(draftBlocker) || selectedIds.size === 0 || generating || selectedIds.size > MAX_BATCH_SIZE}
            >
              {generating
                ? "Writing emails…"
                : selectedIds.size === 0
                  ? "Pick creators to email"
                  : `Write ${selectedIds.size} ${selectedIds.size === 1 ? "email" : "emails"}`}
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
                    className="text-sm font-semibold text-muted-foreground"
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
                        className="text-sm font-semibold text-muted-foreground"
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
            <p className="text-sm text-muted-foreground">
              Only used for creators who don&apos;t already have a written email.
            </p>
            <Textarea
              placeholder="Anything to mention, like a launch date or a discount code"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </details>
      </>
      )}

      {/* Generated Drafts */}
      {step === "review" && drafts.length > 0 && (
        <Card id="review-emails">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Review and send</CardTitle>
                <CardDescription>
                  {drafts.length} {drafts.length === 1 ? "email" : "emails"}. Edit anything you like. Nothing sends until
                  you click Send.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setStep("choose")} disabled={sending}>
                ← Choose different creators
              </Button>
            </div>
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
                      <p className="text-sm text-muted-foreground">
                        {senderAddress ? `From ${senderAddress} · ` : ""}To{" "}
                        {creatorByCcId.get(draft.campaignCreatorId)?.creator.email ?? "no email on file"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!draft.error && draft.body && confirmingSend === draft.campaignCreatorId ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingSend(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={sendingIds.has(draft.campaignCreatorId) || sendingIds.has("all") || Boolean(sendBlocker)}
                          onClick={async () => {
                            setConfirmingSend(null);
                            startSending(draft.campaignCreatorId);
                            try {
                              const res = await fetch("/api/outreach/send", {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  drafts: [
                                    {
                                      campaignCreatorId: draft.campaignCreatorId,
                                      creatorId: draft.creatorId,
                                      channel,
                                      subject:
                                        editedDrafts[draft.campaignCreatorId]?.subject ??
                                        draft.subject ??
                                        undefined,
                                      body: editedDrafts[draft.campaignCreatorId]?.body ?? draft.body!,
                                    },
                                  ],
                                }),
                              });
                              const data = (await res.json().catch(() => ({}))) as SendResponse;
                              await handleSendResult(data, res.ok);
                            } catch {
                              setNotice({ tone: "error", text: "Send failed. Nothing was sent." });
                            } finally {
                              stopSending(draft.campaignCreatorId);
                            }
                          }}
                        >
                          Yes, send to @{draft.creatorHandle}
                        </Button>
                      </>
                    ) : !draft.error && draft.body ? (
                      <Button
                        size="sm"
                        disabled={sendingIds.has(draft.campaignCreatorId) || sendingIds.has("all") || Boolean(sendBlocker)}
                        onClick={() => setConfirmingSend(draft.campaignCreatorId)}
                      >
                        {sendingIds.has(draft.campaignCreatorId) || sendingIds.has("all") ? "Sending..." : "Send"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {draft.error ? (
                  <p className="text-sm text-red-700">{draft.error}</p>
                ) : (
                  <>
                    {channel === "email" && (
                      <div className="space-y-1">
                        <Label className="text-sm">Subject</Label>
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
                      <Label className="text-sm">
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
                      <p className="text-sm font-medium text-amber-800">
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
                  setConfirmingSend(null);
                  setStep("choose");
                }}
              >
                Discard
              </Button>
              {confirmingSend === "all" ? (
                <Button variant="ghost" onClick={() => setConfirmingSend(null)}>
                  Cancel
                </Button>
              ) : null}
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

                  // First click asks, second click sends: a sent email can't be taken back.
                  if (confirmingSend !== "all") {
                    setConfirmingSend("all");
                    return;
                  }
                  setConfirmingSend(null);

                  startSending("all");
                  setSendProgress(`Sending 0 of ${validDrafts.length}…`);

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
                    stopSending("all");
                    setSendProgress("");
                  }
                }}
              >
                {sendingIds.has("all")
                  ? sendProgress || "Sending…"
                  : confirmingSend === "all"
                    ? `Yes, send ${drafts.filter((d) => !d.error).length} now`
                    : `Send all (${drafts.filter((d) => !d.error).length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
