import type { StatusTone } from "@/components/status-pill";

/** Words and pill tone for a campaign's status, the same on the list and the campaign page. */
const CAMPAIGN_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Not started", tone: "neutral" },
  active: { label: "Sending", tone: "good" },
  paused: { label: "Paused", tone: "neutral" },
  completed: { label: "Finished", tone: "good" },
  archived: { label: "Archived", tone: "neutral" },
};

export function campaignStatus(status: string): { label: string; tone: StatusTone } {
  return CAMPAIGN_STATUS[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" };
}
