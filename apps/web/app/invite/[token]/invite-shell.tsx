import type { ReactNode } from "react";

/**
 * The warm page around every invite screen, matching the creator pages
 * (/claim and /rights): paper background, white card, Kalm logo + Seed Scale.
 */
export function InviteShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f3ec] px-4 py-8 text-neutral-950 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="space-y-6 rounded-[2rem] bg-white p-6 shadow-sm [overflow-wrap:anywhere] sm:p-8">
          <p className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kalm-logo.png" alt="Kalm" className="h-6 w-auto" />
            <span className="h-5 w-px bg-neutral-300" aria-hidden />
            <span className="text-lg font-semibold tracking-tight">Seed Scale</span>
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}
