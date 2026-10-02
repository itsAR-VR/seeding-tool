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

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter / X",
};

const TYPE_LABELS: Record<string, string> = {
  post: "Post",
  story: "Story",
  reel: "Reel",
  video: "Video",
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
    setLoadError(null);
    try {
      const [mentionsRes, creatorsRes] = await Promise.all([
        fetch(`/api/mentions?campaignId=${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/creators`),
      ]);

      if (mentionsRes.ok) {
        const data = (await mentionsRes.json()) as unknown;
        setMentions(Array.isArray(data) ? (data as Mention[]) : []);
      } else {
        const data = (await mentionsRes.json().catch(() => null)) as { error?: string } | null;
        setLoadError(data?.error ?? "Couldn't load posts. Refresh the page to try again.");
      }
      if (creatorsRes.ok) {
        const data = (await creatorsRes.json()) as unknown;
        setCreators(Array.isArray(data) ? (data as CreatorOption[]) : []);
      }
    } catch (error) {
      console.error("Failed to load mentions:", error);
      setLoadError("Couldn't load posts. Check your connection and refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mediaUrl || !form.campaignCreatorId) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Couldn't save that post. Try again.");
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
      setFormError(
        error instanceof Error ? error.message : "Couldn't save that post. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading posts…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-muted-foreground">
            Posts creators made about your gift. Add one by hand if we missed it.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add a post"}
        </Button>
      </div>

      {/* Add mention form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add a post</CardTitle>
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
                <Label>Link to the post</Label>
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

              {formError && (
                <p role="alert" className="text-sm text-red-700">
                  {formError}
                </p>
              )}
              {creators.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add creators to this campaign first, then you can link their posts here.
                </p>
              )}
              <Button type="submit" disabled={submitting || creators.length === 0}>
                {submitting ? "Adding…" : "Add post"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mentions list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            All posts ({mentions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p role="alert" className="py-8 text-center text-red-700">
              {loadError}
            </p>
          ) : mentions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No posts yet. Posts that tag you show up here once Instagram is connected in
              Settings &gt; Connections. You can also add one by hand with Add a post.
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
                        {PLATFORM_LABELS[m.platform] ?? m.platform}
                      </Badge>
                      {m.type && (
                        <Badge variant="outline">{TYPE_LABELS[m.type] ?? m.type}</Badge>
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
                    <div className="flex gap-4 text-sm text-muted-foreground">
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
