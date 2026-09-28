"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Decision = "approve" | "decline";

/** Supabase's per-file limit on our plan. */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function VideoUpload({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_VIDEO_BYTES) {
      setError("That file is over 50 MB. Could you send a shorter or smaller version?");
      return;
    }
    setStatus("uploading");
    try {
      const post = (body: object) =>
        fetch(`/api/rights/${token}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type, ...body }),
        }).then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }));

      const start = await post({});
      if (!start.ok) throw new Error(start.data.error ?? "Upload failed");

      const { error: uploadError } = await createClient()
        .storage.from("mention-media")
        .uploadToSignedUrl(start.data.path, start.data.token, file, { contentType: file.type });
      if (uploadError) throw new Error("Upload failed. Please try again.");

      const finish = await post({ done: true });
      if (!finish.ok) throw new Error(finish.data.error ?? "Upload failed");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return <p className="text-sm text-neutral-700">Got it, thank you!</p>;
  }

  return (
    <div className="space-y-3 rounded-3xl border border-neutral-200 p-5">
      <p className="text-sm leading-6 text-neutral-700">
        If you still have the original video, could you upload it here? Instagram doesn&apos;t let
        brands use songs in ads, so a version without music helps a lot.
      </p>
      <label className="block">
        <span className="sr-only">Choose video</span>
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={status === "uploading"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
          className="block w-full text-sm"
        />
      </label>
      {status === "uploading" && <p className="text-sm text-neutral-600">Uploading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function RightsForm({ token, askForVideo }: { token: string; askForVideo: boolean }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Decision | null>(null);

  async function submit(decision: Decision) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rights/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, name }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(decision);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done === "approve") {
    return (
      <div className="space-y-5">
        <p className="text-sm font-medium">Thank you so much! We can&apos;t wait to share it.</p>
        {askForVideo && <VideoUpload token={token} />}
      </div>
    );
  }
  if (done === "decline") {
    return <p className="text-sm font-medium">Thanks for letting us know. We won&apos;t use this post.</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit("approve");
      }}
    >
      <label className="block text-sm font-medium">
        Your full name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
          className="mt-1 w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-neutral-950 px-6 py-3 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Saving..." : "I agree"}
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit("decline")}
        className="w-full text-sm text-neutral-600 underline"
      >
        No thanks
      </button>
    </form>
  );
}
