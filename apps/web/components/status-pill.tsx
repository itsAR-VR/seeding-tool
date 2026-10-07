import { cn } from "@/lib/utils";

/**
 * One status pill for the whole app. Tone carries meaning the same way
 * everywhere; the label always says the status in words.
 * - good: done or going well (sent, shipped, connected)
 * - waiting: needs you or is in progress (draft, address to check)
 * - problem: something failed and needs a look
 * - neutral: everything else (not started, cancelled, paused)
 */
export type StatusTone = "good" | "waiting" | "problem" | "neutral";

const TONES: Record<StatusTone, string> = {
  good: "bg-green-50 text-green-800 border-green-200",
  waiting: "bg-amber-50 text-amber-900 border-amber-200",
  problem: "bg-red-50 text-red-800 border-red-200",
  neutral: "bg-muted text-foreground/80 border-transparent",
};

export function StatusPill({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 text-sm font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
