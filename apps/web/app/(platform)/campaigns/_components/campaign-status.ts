import type { StatusTone } from "@/components/status-pill";

/** Words and pill tone for a campaign's status, the same on the list and the campaign page. */
const CAMPAIGN_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Not started", tone: "neutral" },
  active: { label: "In progress", tone: "good" },
  paused: { label: "Paused", tone: "neutral" },
  completed: { label: "Finished", tone: "good" },
  archived: { label: "Archived", tone: "neutral" },
};

/**
 * A running campaign's badge says what's actually happening, from its creators:
 * no one added yet, replies waiting on you, approved people still to email, or everyone emailed.
 * Other statuses (draft, paused, finished) are what the brand set.
 */
export function campaignStatus(
  status: string,
  creators?: { total: number; toEmail: number; toAnswer?: number },
): { label: string; tone: StatusTone } {
  if (status === "active" && creators) {
    if (creators.total === 0) return { label: "No creators yet", tone: "neutral" };
    // What needs you comes first: replies waiting beat emails still to send.
    if ((creators.toAnswer ?? 0) > 0) return { label: "Replies to answer", tone: "waiting" };
    if (creators.toEmail > 0) return { label: "Emails to send", tone: "waiting" };
    return { label: "All emailed", tone: "good" };
  }
  return CAMPAIGN_STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" };
}
