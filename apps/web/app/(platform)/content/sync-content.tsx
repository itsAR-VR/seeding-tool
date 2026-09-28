"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SyncResult = { connected: boolean; newPosts: number; updated: number; error?: string };

/** Pulls new tagged posts from Instagram when the page opens, and on demand. */
export function SyncContent() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/content/sync", { method: "POST" });
      const data = (await res.json().catch(() => null)) as SyncResult | { error?: string } | null;
      if (!res.ok || !data || !("connected" in data)) {
        setStatus("Couldn't check for new posts. Try again.");
        return;
      }
      if (!data.connected) {
        setStatus("Connect Instagram in Settings to see posts.");
      } else if (data.error) {
        setStatus(data.error);
      } else {
        setStatus(
          data.newPosts > 0
            ? `${data.newPosts} new post${data.newPosts === 1 ? "" : "s"}`
            : "Up to date"
        );
      }
      if (data.connected) router.refresh();
    } catch {
      setStatus("Couldn't check for new posts. Try again.");
    } finally {
      setSyncing(false);
    }
  }, [router]);

  useEffect(() => {
    void sync();
  }, [sync]);

  return (
    <div className="flex items-center gap-3">
      {status && <span className="text-sm text-muted-foreground">{status}</span>}
      <Button variant="outline" size="sm" onClick={() => void sync()} disabled={syncing}>
        {syncing ? "Checking..." : "Check for new posts"}
      </Button>
    </div>
  );
}
