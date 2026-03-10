"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  campaignId: string;
};

export function TriggerSearchButton({ campaignId }: Props) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={() => router.push(`/campaigns/${campaignId}/discover`)}
    >
      🔍 Discover Creators
    </Button>
  );
}
