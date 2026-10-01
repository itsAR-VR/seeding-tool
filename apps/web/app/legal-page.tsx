import type { ReactNode } from "react";

/** Shared layout for the public privacy and data deletion pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f3ec] px-4 py-10 text-neutral-900">
      <article className="mx-auto max-w-2xl space-y-5 rounded-[2rem] bg-white p-6 text-sm leading-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-neutral-500">Last updated {updated}</p>
        {children}
      </article>
    </main>
  );
}

export const CONTACT_EMAIL = "hello@teamkalm.com";
export const OPERATOR = "Kalm Wellness LLC";
