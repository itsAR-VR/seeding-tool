import type { ScoredCandidate } from "@/lib/creator-search/scoring/composite";

function summarizeComponent(label: string, value: { score: number; signals: string[] }) {
  const score = value.score.toFixed(2);
  const topSignals = value.signals.slice(0, 2).join(", ") || "limited evidence";
  return `${label} ${score} (${topSignals})`;
}

export function generateFitReasoning(scored: ScoredCandidate) {
  return [
    summarizeComponent("Topical match", scored.components.topicalMatch),
    summarizeComponent("Engagement", scored.components.engagementQuality),
    summarizeComponent("Authenticity", scored.components.authenticity),
    summarizeComponent("Identity", scored.components.identityConfidence),
    summarizeComponent("Contactability", scored.components.contactability),
    `Triage: ${scored.triage}`,
  ].join(". ");
}
