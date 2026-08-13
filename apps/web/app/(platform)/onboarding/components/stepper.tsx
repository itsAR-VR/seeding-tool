"use client";

import { ONBOARDING_STEPS } from "./constants";

export function Stepper({
  stepIndex,
  isBrandStep,
}: {
  stepIndex: number;
  isBrandStep: boolean;
}) {
  return (
    <div
      className={`mb-8 flex items-center justify-center gap-2 ${isBrandStep ? "text-stone-200" : ""}`}
    >
      {ONBOARDING_STEPS.map((entry, index) => {
        const isCurrent = index === stepIndex;
        const isComplete = index < stepIndex;

        return (
          <div key={entry} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                isBrandStep
                  ? isCurrent
                    ? "border border-[#d6df9f]/60 bg-[#d6df9f] text-[#161813]"
                    : isComplete
                      ? "border border-[#d6df9f]/40 bg-[#d6df9f]/20 text-[#d6df9f]"
                      : "border border-white/12 bg-white/5 text-stone-400"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
            {index < ONBOARDING_STEPS.length - 1 && (
              <div
                className={`h-px w-12 ${
                  isBrandStep ? "bg-white/12" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
