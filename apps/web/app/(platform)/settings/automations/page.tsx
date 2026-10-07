"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnifiedKeywordSelector } from "@/components/unified-keyword-selector";
import { formatDateTime } from "@/lib/format/date";

type Automation = {
  id: string;
  name: string;
  type: string;
  schedule: string;
  config: {
    keywords?: string[];
    hashtag?: string;
    usernames?: string[];
    limit?: number;
    categories?: { apify?: string[]; collabstr?: string[] };
  };
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

const SCHEDULES = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "every_12h", label: "Twice a day" },
  { value: "every_6h", label: "Every 6 hours" },
] as const;

const scheduleLabel = (value: string) => SCHEDULES.find((s) => s.value === value)?.label ?? value;

function when(iso: string | null) {
  if (!iso) return "not yet";
  return formatDateTime(iso);
}

/** What a saved automation searches for, in words. Older ones used hashtags or categories. */
function searchingFor(a: Automation) {
  const words = a.config.keywords?.length
    ? a.config.keywords
    : [
        ...(a.config.hashtag ? [`#${a.config.hashtag}`] : []),
        ...(a.config.categories?.apify ?? []),
        ...(a.config.categories?.collabstr ?? []),
        ...(a.config.usernames ?? []).map((u) => `@${u}`),
      ];
  return words.length ? words.join(", ") : "your brand's search words";
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [searchReady, setSearchReady] = useState(true);
  const [words, setWords] = useState<string[]>([]);
  const [pending, setPending] = useState("");
  const [limit, setLimit] = useState("25");
  const [schedule, setSchedule] = useState<string>("daily");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/automations");
    const data = (await res.json().catch(() => null)) as { automations?: Automation[] } | null;
    setAutomations(data?.automations ?? []);
  }, []);

  useEffect(() => {
    void fetch("/api/automations")
      .then((r) => r.json())
      .then((d: { automations?: Automation[] }) => setAutomations(d.automations ?? []))
      .catch(() => setAutomations([]));
    void fetch("/api/settings/apify")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { hasOwnKey: boolean; usesShared: boolean } | null) => setSearchReady(Boolean(d?.hasOwnKey || d?.usesShared)))
      .catch(() => setSearchReady(false));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const all = pending ? [...words, pending] : words;
    const count = Number(limit);
    if (all.length === 0) return setNotice({ ok: false, text: "Add at least one thing to search for." });
    if (!Number.isInteger(count) || count < 1 || count > 200) {
      return setNotice({ ok: false, text: "Pick a number of creators between 1 and 200." });
    }
    setSaving(true);
    setNotice(null);
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Find: ${all.join(", ")}`.slice(0, 120),
        type: "creator_discovery",
        schedule,
        config: { keywords: all, limit: count, autoImport: true },
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!res.ok) return setNotice({ ok: false, text: data?.error ?? "Couldn't save it. Try again." });
    setWords([]);
    setPending("");
    setNotice({ ok: true, text: "Saved. The first search runs within about 10 minutes." });
    await load();
  }

  async function toggle(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    if (!res.ok) setNotice({ ok: false, text: "Couldn't change it. Try again." });
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
    setConfirmingDelete(null);
    if (!res.ok) setNotice({ ok: false, text: "Couldn't delete it. Try again." });
    await load();
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Scheduled searches</h1>
        <p className="mt-1 text-muted-foreground">
          Find new creators on a schedule. New finds are added to Creators for you to review.
        </p>
      </header>

      {!searchReady && (
        <p className="rounded-xl border bg-card p-4">
          Creator search isn&apos;t set up yet, so these won&apos;t run.{" "}
          <Link href="/settings/creator-search" className="font-medium underline">
            Set up creator search
          </Link>
        </p>
      )}

      <section aria-labelledby="list-heading" className="space-y-3">
        <h2 id="list-heading" className="text-lg font-semibold">
          Your scheduled searches
        </h2>
        {automations === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        ) : automations.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-muted-foreground">None yet. Add one below.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {automations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">{searchingFor(a)}</p>
                  <p className="text-sm text-muted-foreground">
                    {scheduleLabel(a.schedule)}, {a.config.limit ?? 25} creators each time · Last ran {when(a.lastRunAt)}
                    {a.enabled ? ` · Next ${when(a.nextRunAt)}` : ""}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" checked={a.enabled} onChange={() => void toggle(a)} />
                  {a.enabled ? "On" : "Off"}
                </label>
                {confirmingDelete === a.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    Delete it?
                    <Button size="sm" variant="destructive" onClick={() => void remove(a.id)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(a.id)}>
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={(e) => void create(e)} className="space-y-5 rounded-xl border bg-card p-6" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-lg font-semibold">
          Add a scheduled search
        </h2>
        <UnifiedKeywordSelector groups={[]} selected={words} onChange={setWords} onPendingChange={setPending} />
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <label htmlFor="limit" className="block text-sm font-medium">
              Creators each time
            </label>
            <Input
              id="limit"
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="schedule" className="block text-sm font-medium">
              How often
            </label>
            <select
              id="schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="h-9 rounded-lg border bg-background px-3"
            >
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Each run uses some of your search allowance, so start with every day or every week and 10 to 25 creators.
        </p>
        {notice && (
          <p role="status" className={`text-sm ${notice.ok ? "text-green-800" : "text-destructive"}`}>
            {notice.text}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save scheduled search"}
        </Button>
      </form>
    </div>
  );
}
