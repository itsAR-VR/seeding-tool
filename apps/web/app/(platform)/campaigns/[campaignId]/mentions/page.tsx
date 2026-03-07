"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mention = {
  id: string;
  platform: string;
  mediaUrl: string;
  type: string | null;
  caption: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  postedAt: string | null;
  createdAt: string;
  campaignCreator: {
    id: string;
    creator: { name: string | null; email: string | null };
    campaign: { id: string; name: string };
  };
};

type CreatorOption = {
  id: string;
  creator: { name: string | null; email: string | null };
};

const platformColors: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-800",
  tiktok: "bg-gray-900 text-white",
  youtube: "bg-red-100 text-red-800",
  twitter: "bg-blue-100 text-blue-800",
};

export default function MentionsPage() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [mentions, setMentions] = useState<Mention[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    platform: "instagram",
    mediaUrl: "",
    type: "post",
    caption: "",
    campaignCreatorId: "",
  });

  useEffect(() => {
    loadData();
  }, [campaignId]);

  async function loadData() {
    setLoading(true);
    try {
      const [mentionsRes, creatorsRes] = await Promise.all([
        fetch(`/api/mentions?campaignId=${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/creators`),
      ]);

      if (mentionsRes.ok) {
        setMentions((await mentionsRes.json()) as Mention[]);
      }
      if (creatorsRes.ok) {
        setCreators((await creatorsRes.json()) as CreatorOption[]);
      }
    } catch (error) {
      console.error("Failed to load mentions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mediaUrl || !form.campaignCreatorId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to create mention");
      }

      setShowForm(false);
      setForm({
        platform: "instagram",
        mediaUrl: "",
        type: "post",
        caption: "",
        campaignCreatorId: "",
      });
      await loadData();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to create mention"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading mentions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mentions</h1>
          <p className="text-muted-foreground">
            Track and attribute creator mentions
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Mention"}
        </Button>
      </div>

      {/* Add mention form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Mention</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.platform}
                    onChange={(e) =>
                      setForm({ ...form, platform: e.target.value })
                    }
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="twitter">Twitter / X</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value })
                    }
                  >
                    <option value="post">Post</option>
                    <option value="story">Story</option>
                    <option value="reel">Reel</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Media URL</Label>
                <Input
                  placeholder="https://instagram.com/p/..."
                  value={form.mediaUrl}
                  onChange={(e) =>
                    setForm({ ...form, mediaUrl: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Creator</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.campaignCreatorId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      campaignCreatorId: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select creator…</option>
                  {creators.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.creator.name || cc.creator.email || cc.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Caption (optional)</Label>
                <Input
                  placeholder="Post caption"
                  value={form.caption}
                  onChange={(e) =>
                    setForm({ ...form, caption: e.target.value })
                  }
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding…" : "Add Mention"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mentions list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            All Mentions ({mentions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mentions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No mentions yet
            </p>
          ) : (
            <div className="space-y-4">
              {mentions.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          platformColors[m.platform] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {m.platform}
                      </Badge>
                      {m.type && (
                        <Badge variant="outline">{m.type}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">
                      {m.campaignCreator.creator.name ||
                        m.campaignCreator.creator.email ||
                        "Unknown"}
                    </p>
                    {m.caption && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {m.caption}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {m.likes != null && <span>❤️ {m.likes}</span>}
                      {m.comments != null && (
                        <span>💬 {m.comments}</span>
                      )}
                      {m.views != null && <span>👁 {m.views}</span>}
                    </div>
                  </div>
                  <a
                    href={m.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm text-blue-600 hover:underline"
                  >
                    View →
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
