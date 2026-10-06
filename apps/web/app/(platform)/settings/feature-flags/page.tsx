"use client";

import { useState, useEffect, useCallback } from "react";
import type { FeatureFlags } from "@/lib/feature-flags";

/**
 * Feature switches for this brand.
 *
 * Admin-only toggles for per-brand feature flags. Flag semantics live in
 * lib/feature-flags.ts and are unchanged here; this page only explains them.
 *
 * `available: false` marks flags that are only read by background tasks that
 * run on Inngest, which is not running. Only content sync and reply sync run
 * (Supabase pg_cron calling /api/cron/*), and neither reads these flags.
 */

type FlagCopy = {
  label: string;
  description: string;
  available: boolean;
  /** Shown under "Not available yet": what happens today instead. */
  note?: string;
};

const FLAG_COPY: Record<keyof FeatureFlags, FlagCopy> = {
  claimAutoDraftEnabled: {
    label: "Save a draft order when a creator fills in the gift form",
    description:
      "Saves a draft gift order in Shopify the moment a creator sends their address. A draft never ships anything, and this works whether the next switch is on or off.",
    available: true,
  },
  shopifyOrderEnabled: {
    label: "Create and complete orders from this tool",
    description:
      "Lets you create gift orders and complete drafts from a creator's page here. When off, you finish orders in Shopify yourself.",
    available: true,
  },
  unipileDmEnabled: {
    label: "Send Instagram messages",
    description:
      "Lets you message creators on Instagram from the inbox. Needs Instagram messages (Unipile) connected, which is a separate paid service.",
    available: true,
  },
  decisionEngineScoringEnabled: {
    label: "Detailed match scores",
    description:
      "Shows why each creator is or isn't a good match for your brand, not just a single score.",
    available: true,
  },
  portfolioOptimizerEnabled: {
    label: "Suggested creator mix",
    description:
      "Suggests a balanced group of creators for each campaign. Needs Detailed match scores turned on too.",
    available: true,
  },
  outcomeLearningEnabled: {
    label: "Learn from past campaigns",
    description:
      "Tracks which creators posted and how their posts did, so results and future suggestions get better over time.",
    available: true,
  },
  identityGraphEnabled: {
    label: "Spot the same creator across accounts",
    description:
      "Notices when two creator records look like the same person and lists them for you to check.",
    available: true,
  },
  identityAutoLinkEnabled: {
    label: "Merge obvious duplicates for me",
    description:
      "Joins creator records automatically when they are clearly the same person. Merges can't be undone, so leave this off until you trust the matches.",
    available: true,
  },
  aiReplyEnabled: {
    label: "Instant reply suggestions",
    description: "Drafts a suggested answer the moment a creator replies.",
    available: false,
    note: "Suggested replies still appear in your inbox after the regular reply check, whether this is on or off.",
  },
  reminderEmailEnabled: {
    label: "Reminder emails after delivery",
    description: "Emails creators a gentle reminder to post once their gift has arrived.",
    available: false,
    note: "No reminders are sent right now, whether this is on or off.",
  },
  instagramMentionPollEnabled: {
    label: "Extra check for Instagram mentions",
    description: "An additional check for posts that mention your brand.",
    available: false,
    note: "Tagged posts are still found by the regular content check, whether this is on or off.",
  },
};

const FLAG_ORDER = Object.keys(FLAG_COPY) as Array<keyof FeatureFlags>;

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/feature-flags");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Couldn't load these settings. Refresh the page to try again.");
        return;
      }
      const data = await res.json();
      setFlags(data.flags);
      setError(null);
    } catch {
      setError("Couldn't load these settings. Check your connection and refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const toggleFlag = async (flag: keyof FeatureFlags) => {
    if (!flags) return;

    setUpdating(flag);
    try {
      const res = await fetch("/api/settings/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag, value: !flags[flag] }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Couldn't save that change. Try again.");
        return;
      }

      const data = await res.json();
      setFlags(data.flags);
      setError(null);
    } catch {
      setError("Couldn't save that change. Check your connection and try again.");
    } finally {
      setUpdating(null);
    }
  };

  const header = (
    <header>
      <h1 className="text-3xl font-bold tracking-tight">Features</h1>
      <p className="mt-1 text-muted-foreground">
        Turn parts of the tool on or off for your brand.
      </p>
    </header>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {header}
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !flags) {
    return (
      <div className="space-y-8">
        {header}
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      </div>
    );
  }

  const renderRow = (flag: keyof FeatureFlags) => {
    const copy = FLAG_COPY[flag];
    const on = Boolean(flags?.[flag]);
    const busy = updating === flag;
    return (
      <li key={flag} className="flex items-start justify-between gap-6 px-5 py-4">
        <div className="space-y-1">
          <p className="font-medium">{copy.label}</p>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
          {copy.note && <p className="text-sm text-muted-foreground">{copy.note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="w-8 text-sm font-medium">{on ? "On" : "Off"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={copy.label}
            onClick={() => toggleFlag(flag)}
            disabled={busy}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              on ? "bg-green-600" : "bg-muted-foreground/30"
            } ${busy ? "opacity-50" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                on ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </li>
    );
  };

  // Switches marked available: false have no effect yet, so they stay hidden.
  // Their flag values are left untouched.
  const working = FLAG_ORDER.filter((flag) => FLAG_COPY[flag].available);

  return (
    <div className="space-y-8">
      {header}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      <ul className="divide-y rounded-xl border bg-card">{working.map(renderRow)}</ul>

      <p className="text-sm text-muted-foreground">
        If these settings ever fail to load, every feature stays off to be safe, so nothing gets
        sent or ordered by mistake.
      </p>
    </div>
  );
}
