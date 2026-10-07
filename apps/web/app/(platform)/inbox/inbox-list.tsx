"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";
import { STAGE_DISPLAY } from "@/lib/stats/stage-display";
import { decisionStatusLabel, offerUndo, postDecision } from "./decision-actions";

export type InboxRow = {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  lastMessage: { direction: string; body: string } | null;
  updatedAt: string;
  decision: string | null;
  needsCall: boolean;
  hasDraft: boolean;
  addressToConfirm: boolean;
};

type BulkDecision = "no" | "later";

/**
 * The conversation list. On "Needs your answer" each row gets a checkbox so
 * several replies can be answered "Not right now" or "No" in one go.
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
    setWorking(true);
    setNotice(null);
    // No confirm: act now, offer Undo. Everything on this tab had no answer yet.
    const errors = await Promise.all(chosen.map((id) => postDecision(id, decision)));
    const saved = chosen.filter((_, i) => !errors[i]);
    const failed = chosen.filter((_, i) => errors[i]);
    const label = decisionStatusLabel(decision);
    setSelected(new Set(failed));
    if (failed.length > 0) {
      setNotice({
        tone: "error",
        text: `Marked ${saved.length} as ${label}. ${failed.length} didn't save and are still selected. Try again.`,
      });
    }
    if (saved.length > 0) {
      offerUndo({
        message:
          decision === "no"
            ? `Marked ${saved.length} as ${label}. Added to the do-not-send list.`
            : `Marked ${saved.length} as ${label}.`,
        previous: Object.fromEntries(saved.map((id) => [id, null])),
        onUndone: () => router.refresh(),
      });
    }
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
              No
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
                  {row.decision === "yes" && <Pill stage="said_yes" />}
                  {row.decision === "no" && <Pill stage="said_no" />}
                  {row.decision === "later" && <Pill stage="not_now" />}
                  {row.needsCall && showNeedsPill && <Pill stage="needs_answer" />}
                  {row.hasDraft && <StatusPill tone="neutral">Reply drafted</StatusPill>}
                  {row.addressToConfirm && <Pill stage="address_to_check" />}
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

/** A status pill in the shared words and tone (lib/stats/stage-display). */
function Pill({ stage }: { stage: "said_yes" | "said_no" | "not_now" | "needs_answer" | "address_to_check" }) {
  const { label, tone } = STAGE_DISPLAY[stage];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}
