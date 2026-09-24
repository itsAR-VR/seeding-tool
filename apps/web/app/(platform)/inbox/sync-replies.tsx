"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SyncResult = { processed: number; inboxes: number; errors: string[] };

/** Pulls new creator replies from Gmail when the Inbox opens, and on demand. */
export function SyncReplies() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = (await res.json().catch(() => null)) as SyncResult | { error?: string } | null;
      if (!res.ok || !data || !("processed" in data)) {
        setStatus("Couldn't check for replies. Try again.");
        return;
      }
      if (data.inboxes === 0) {
        setStatus("Connect Gmail in Settings to see replies.");
      } else if (data.errors.length > 0) {
        setStatus(`Couldn't read ${data.errors.length} inbox${data.errors.length === 1 ? "" : "es"}. Try reconnecting Gmail.`);
      } else {
        setStatus(
          data.processed > 0
            ? `${data.processed} new repl${data.processed === 1 ? "y" : "ies"}`
            : "Up to date"
        );
      }
      if (data.processed > 0) router.refresh();
    } catch {
      setStatus("Couldn't check for replies. Try again.");
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
        {syncing ? "Checking..." : "Check for replies"}
      </Button>
    </div>
  );
}
