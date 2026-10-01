"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_RIGHTS_MONTHS, RIGHTS_DURATIONS } from "@/lib/content/rights-options";

type Props = {
  postId: string;
  status: string;
};

/** Creates the usage-rights link for a post and shows the message to send. */
export function RightsAction({ postId, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<number>(DEFAULT_RIGHTS_MONTHS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createRequest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${postId}/rights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok || !data?.message) {
        setError(data?.error ?? "Couldn't create the request.");
        return;
      }
      setMessage(data.message);
      router.refresh();
    } catch {
      setError("Couldn't create the request.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        {status === "requested" ? "Copy request again" : "Request rights"}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-2">
      {!message ? (
        <>
          <label className="block text-sm text-muted-foreground">
            How long
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm text-foreground"
            >
              {RIGHTS_DURATIONS.map((d) => (
                <option key={d.months} value={d.months}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" className="w-full" onClick={() => void createRequest()} disabled={busy}>
            {busy ? "Creating..." : "Create request"}
          </Button>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words text-xs">{message}</p>
          <Button size="sm" className="w-full" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy message"}
          </Button>
          <p className="text-sm text-muted-foreground">Send it to them in an Instagram DM.</p>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
