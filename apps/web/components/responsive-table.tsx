import { cn } from "@/lib/utils";

/**
 * One pattern for lists that are a table on wide screens and stacked rows on
 * phones. Render both: the table inside <WideOnly>, the rows inside
 * <StackedList>. CSS shows exactly one, so nobody scrolls sideways on a phone.
 */

/** Row actions are at least 44px tall on phones, normal size from md up. */
export const TAP_TARGET = "h-11 md:h-8";

/** Same, for small buttons that are 28px on desktop. */
export const TAP_TARGET_SM = "h-11 md:h-7";

/** Wraps the table; hidden on phones. */
export function WideOnly({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("hidden md:block", className)} {...props} />;
}

/** The phone version: one stacked row per item, hidden from md up. */
export function StackedList({ label, className, ...props }: React.ComponentProps<"ul"> & { label: string }) {
  return <ul aria-label={label} className={cn("divide-y md:hidden", className)} {...props} />;
}

export function StackedRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={cn("min-w-0 space-y-2 py-4 first:pt-0 last:pb-0", className)}>{children}</li>;
}

/** A labelled value inside a stacked row: "Spend   $12.40". */
export function StackedField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}
