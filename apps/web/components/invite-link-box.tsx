"use client";

import { useState } from "react";

/** Shows a fresh invite link with a copy button and what to do with it. */
export function InviteLinkBox({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="font-medium text-green-900">Invite ready. Send this link to {email}:</p>
      <div className="flex gap-2">
        <input readOnly value={link} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(link);
            setCopied(true);
          }}
          className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="text-sm text-green-900">It works once and expires in 14 days.</p>
    </div>
  );
}
