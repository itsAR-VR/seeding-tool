/** Usage-rights length choices. Safe to import from client components. */
export const RIGHTS_DURATIONS = [
  { months: 12, label: "12 months" },
  { months: 6, label: "6 months" },
  { months: 0, label: "No end date" },
] as const;

export const DEFAULT_RIGHTS_MONTHS = 12;

export function isValidRightsMonths(value: unknown): value is number {
  return RIGHTS_DURATIONS.some((d) => d.months === value);
}
