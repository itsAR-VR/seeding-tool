import { STAGE_DISPLAY, STAGE_HELP, type DisplayStage } from "@/lib/stats/stage-display";

/**
 * A small "What do these mean?" disclosure: one line per status shown on the
 * page, in the same words as the pills (lib/stats/stage-display).
 */
export function StageHelp({ stages, className }: { stages: readonly DisplayStage[]; className?: string }) {
  const unique = [...new Set(stages)];
  if (unique.length === 0) return null;
  return (
    <details className={className ?? "text-sm"}>
      <summary className="w-fit cursor-pointer select-none text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        What do these mean?
      </summary>
      <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-xl border bg-card px-4 py-3 sm:grid-cols-[max-content_1fr]">
        {unique.map((stage) => (
          <div key={stage} className="contents">
            <dt className="font-medium">{STAGE_DISPLAY[stage].label}</dt>
            <dd className="text-muted-foreground">{STAGE_HELP[stage]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
