"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";

export type InboxRow = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  lastMessage: { direction: string; body: string } | null;
  updatedAt: string;
  decision: string | null;
  needsCall: boolean;
  askedToBeRemoved: boolean;
  hasDraft: boolean;
  addressToConfirm: boolean;
};

type BulkDecision = "no" | "later";

/**
 * The conversation list. On "Needs your call" each row gets a checkbox so
 * several replies can be marked "Not right now" or "Said no" in one go.
 */
export function InboxList({ rows, selectable, showNeedsPill }: { rows: InboxRow[]; selectable: boolean; showNeedsPill: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const visibleIds = rows.map((r) => r.id);
  const chosen = visibleIds.filter((id) => selected.has(id));
  const allChosen = chosen.length > 0 && chosen.length === visibleIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChosen ? new Set() : new Set(visibleIds));
  }

  async function applyBulk(decision: BulkDecision) {
    if (chosen.length === 0) return;
    const count = `${chosen.length} creator${chosen.length === 1 ? "" : "s"}`;
    if (
      decision === "no" &&
      !confirm(`Mark ${count} as no? They'll go on the do-not-send list and won't be emailed again.`)
    ) {
      return;
    }
    setWorking(true);
    setNotice(null);
    const results = await Promise.allSettled(
      chosen.map((id) =>
        fetch(`/api/inbox/${id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }).then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return id;
        })
      )
    );
    const failed = chosen.filter((_, i) => results[i]?.status === "rejected");
    const done = chosen.length - failed.length;
    const label = decision === "no" ? "said no" : "not right now";
    setSelected(new Set(failed));
    setNotice(
      failed.length === 0
        ? { tone: "success", text: `Marked ${done} as ${label}.` }
        : {
            tone: "error",
            text: `Marked ${done} as ${label}. ${failed.length} didn't save and are still selected. Try again.`,
          }
    );
    setWorking(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {selectable && rows.length > 0 && (
        <div
          role="toolbar"
          aria-label="Decide on several replies"
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-3"
        >
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-foreground"
              checked={allChosen}
              onChange={toggleAll}
            />
            Select all
          </label>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {chosen.length > 0 ? `${chosen.length} selected` : "Pick replies to decide on together"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={working || chosen.length === 0}
              onClick={() => void applyBulk("later")}
            >
              Not right now
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={working || chosen.length === 0}
              onClick={() => void applyBulk("no")}
            >
              Said no
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role={notice.tone === "success" ? "status" : "alert"}
          className={`rounded-lg border px-4 py-2 text-sm ${
            notice.tone === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </p>
      )}

      <ul className="divide-y rounded-xl border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="relative transition-colors hover:bg-muted/50">
            <Link
              href={`/inbox/${row.id}`}
              aria-label={`Open conversation with ${row.name}`}
              className="absolute inset-0 z-0"
            />
            <div className="flex items-start gap-4 px-5 py-4">
              {selectable && (
                <input
                  type="checkbox"
                  aria-label={`Select ${row.name}`}
                  className="relative z-10 mt-1 size-4 shrink-0 accent-foreground"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{row.name}</p>
                  {row.decision === "yes" && <StatusPill tone="good">Said yes</StatusPill>}
                  {row.askedToBeRemoved ? (
                    <StatusPill tone="neutral">Asked to be removed</StatusPill>
                  ) : (
                    row.decision === "no" && <StatusPill tone="neutral">Said no</StatusPill>
                  )}
                  {row.decision === "later" && <StatusPill tone="neutral">Not right now</StatusPill>}
                  {row.needsCall && showNeedsPill && <StatusPill tone="waiting">Needs your call</StatusPill>}
                  {row.hasDraft && <StatusPill tone="neutral">Reply drafted</StatusPill>}
                  {row.addressToConfirm && <StatusPill tone="waiting">Address to check</StatusPill>}
                </div>
                {row.lastMessage && (
                  <p className="mt-1 truncate text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {row.lastMessage.direction === "inbound" ? "They wrote: " : "You wrote: "}
                    </span>
                    {row.lastMessage.body.slice(0, 120)}
                  </p>
                )}
                <p className="relative z-10 mt-1 w-fit text-sm text-muted-foreground">
                  <Link href={`/campaigns/${row.campaignId}`} className="hover:text-foreground hover:underline">
                    {row.campaignName}
                  </Link>
                </p>
              </div>
              <time dateTime={row.updatedAt} className="shrink-0 text-sm text-muted-foreground">
                {formatDate(row.updatedAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
