"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreatorOption = { id: string; name: string };

const EMPTY_FORM = {
  platform: "instagram",
  mediaUrl: "",
  type: "post",
  caption: "",
  campaignCreatorId: "",
};

/** "Add a post by hand" for posts the Instagram feed missed (TikTok, YouTube, untagged posts). */
export function AddPostForm({ creators }: { creators: CreatorOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mediaUrl || !form.campaignCreatorId) return;

    setSubmitting(true);
    setError(null);
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
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that post. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Add a post by hand
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Add a post by hand</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-platform">Where it was posted</Label>
          <select
            id="post-platform"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="twitter">X (Twitter)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="post-type">Kind of post</Label>
          <select
            id="post-type"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="post">Post</option>
            <option value="story">Story</option>
            <option value="reel">Reel</option>
            <option value="video">Video</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-url">Link to the post</Label>
        <Input
          id="post-url"
          placeholder="https://instagram.com/p/..."
          value={form.mediaUrl}
          onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-creator">Creator</Label>
        <select
          id="post-creator"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={form.campaignCreatorId}
          onChange={(e) => setForm({ ...form, campaignCreatorId: e.target.value })}
          required
        >
          <option value="">Pick a creator</option>
          {creators.map((cc) => (
            <option key={cc.id} value={cc.id}>
              {cc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-caption">Caption (optional)</Label>
        <Input
          id="post-caption"
          placeholder="What the post said"
          value={form.caption}
          onChange={(e) => setForm({ ...form, caption: e.target.value })}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {creators.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add creators to this campaign first, then you can link their posts here.
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || creators.length === 0}>
          {submitting ? "Adding…" : "Add post"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
