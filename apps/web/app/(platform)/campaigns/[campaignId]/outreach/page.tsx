"use client";

import { useEffect, useState } from "react";
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
    followerCount: number | null;
    bio: string | null;
  };
};

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
  const [loading, setLoading] = useState(false);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState("");

  // Load campaign creators
  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [campaignId]);

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

  const toggleCreator = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === creators.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(creators.map((c) => c.id)));
    }
  };

  const generateDrafts = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
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
      } else {
        const err = await res.json();
        console.error("Draft generation failed:", err);
      }
    } catch (err) {
      console.error("Draft generation error:", err);
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

  const approvedCreators = creators.filter(
    (c) => c.reviewStatus === "approved"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Draft Outreach</h1>
        <p className="text-muted-foreground">
          Generate AI-powered outreach messages for campaign creators.
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Choose your persona, channel, and add any extra context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Persona</Label>
              <Select value={personaId} onValueChange={(v) => v && setPersonaId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select persona" />
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="instagram_dm">
                    💬 Instagram DM
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional Context / Talking Points</Label>
            <Textarea
              placeholder="Add any specific brand context, talking points, or instructions for the AI..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Creator Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Select Creators</CardTitle>
              <CardDescription>
                {loadingCreators
                  ? "Loading..."
                  : `${approvedCreators.length} approved creators available`}
              </CardDescription>
            </div>
            {approvedCreators.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === creators.length
                  ? "Deselect All"
                  : "Select All"}
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
              {approvedCreators.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(cc.id)}
                    onCheckedChange={() => toggleCreator(cc.id)}
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
                    {cc.creator.followerCount && (
                      <span className="text-xs text-muted-foreground">
                        {cc.creator.followerCount.toLocaleString()} followers
                      </span>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs"
                  >
                    {cc.lifecycleStatus.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              onClick={generateDrafts}
              disabled={selectedIds.size === 0 || generating}
            >
              {generating
                ? "Generating..."
                : `Generate Drafts (${selectedIds.size})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Drafts */}
      {drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Drafts</CardTitle>
            <CardDescription>
              Review and edit each draft before sending.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {drafts.map((draft) => (
              <div
                key={draft.campaignCreatorId}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {draft.creatorName ?? draft.creatorHandle}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      @{draft.creatorHandle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {draft.tokens} tokens
                    </span>
                    {!draft.error && draft.body && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sending}
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
                            const data = await res.json();
                            if (!res.ok) {
                              alert(data.error || "Send failed");
                            } else {
                              alert(
                                data.sent > 0
                                  ? `Sent to @${draft.creatorHandle}`
                                  : `Failed: ${data.results?.[0]?.error || "Unknown error"}`
                              );
                            }
                          } catch {
                            alert("Send failed");
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
                        rows={channel === "instagram_dm" ? 3 : 8}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setDrafts([]);
                  setEditedDrafts({});
                }}
              >
                Discard All
              </Button>
              <Button
                disabled={
                  sending || drafts.filter((d) => !d.error).length === 0
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

                    const data = await res.json();

                    if (!res.ok) {
                      alert(data.error || "Send failed");
                    } else {
                      setSendProgress("");
                      alert(
                        `Send complete: ${data.sent} sent, ${data.failed} failed, ${data.noContact} missing contact info`
                      );
                    }
                  } catch {
                    alert("Send request failed");
                  } finally {
                    setSending(false);
                    setSendProgress("");
                  }
                }}
              >
                {sending
                  ? sendProgress || "Sending..."
                  : `Send All (${drafts.filter((d) => !d.error).length})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
