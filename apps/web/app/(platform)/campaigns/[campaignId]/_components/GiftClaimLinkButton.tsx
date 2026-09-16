"use client";

import { useState } from "react";
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
        throw new Error(body.error ?? "Failed to generate claim link");
      }

      await navigator.clipboard.writeText(body.claimUrl);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch (error) {
      setState("idle");
      alert(error instanceof Error ? error.message : "Failed to copy claim link");
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
          : "Copy claim link"}
    </Button>
  );
}
