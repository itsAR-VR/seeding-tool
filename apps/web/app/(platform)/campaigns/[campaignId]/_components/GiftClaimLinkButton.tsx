"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type GiftClaimLinkButtonProps = {
  campaignId: string;
  creatorId: string;
  disabled?: boolean;
};

export function GiftClaimLinkButton({
  campaignId,
  creatorId,
  disabled = false,
}: GiftClaimLinkButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "copied">("idle");

  async function generateAndCopy() {
    setState("loading");
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/creators/${creatorId}/gift-claim`,
        { method: "POST" }
      );

      const body = (await response.json()) as {
        claimUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.claimUrl) {
        throw new Error(body.error ?? "Couldn't make the address link. Try again.");
      }

      await navigator.clipboard.writeText(body.claimUrl);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch (error) {
      setState("idle");
      toast.error(error instanceof Error ? error.message : "Couldn't copy the address link. Try again.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={generateAndCopy}
      disabled={disabled || state === "loading"}
    >
      {state === "loading"
        ? "Generating…"
        : state === "copied"
          ? "Copied"
          : "Copy address link"}
    </Button>
  );
}
