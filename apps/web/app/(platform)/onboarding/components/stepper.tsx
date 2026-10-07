import { Check } from "lucide-react";
import { ONBOARDING_STEPS, STEP_LABELS, type OnboardingStep } from "./constants";

/** Where you are in setup, in words. */
export function Stepper({ current }: { current: OnboardingStep }) {
  const currentIndex = ONBOARDING_STEPS.indexOf(current);
  return (
    <ol className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Setup steps">
      {ONBOARDING_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            <span
              className={`flex size-7 items-center justify-center rounded-full text-sm font-medium ${
                active
                  ? "bg-foreground text-background"
                  : done
                    ? "bg-foreground/10 text-foreground"
                    : "border text-muted-foreground"
              }`}
            >
              {done ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>
              {STEP_LABELS[step]}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {index < ONBOARDING_STEPS.length - 1 && <span className="hidden h-px w-8 bg-border sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
