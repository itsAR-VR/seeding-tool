"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildOnboardingParams } from "./constants";

export function ConnectStep({
  brandName,
  brandId,
}: {
  brandName: string;
  brandId: string;
}) {
  const router = useRouter();
  const returnTo = buildOnboardingParams("preset", { brandName, brandId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your channels</CardTitle>
        <CardDescription>
          Connect Gmail and Shopify now, or finish onboarding and do it later in
          Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Your discovery automation is ready. Connections are optional for this
          step, but adding them next will make outreach and product sync usable
          immediately.
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            router.push(
              `/settings/connections?returnTo=${encodeURIComponent(`/onboarding?${returnTo}`)}`
            )
          }
        >
          Open Connections
        </Button>
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() =>
              router.push(
                `/onboarding?${buildOnboardingParams("discovery", {
                  brandName,
                  brandId,
                })}`
              )
            }
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() =>
              router.push(
                `/onboarding?${buildOnboardingParams("preset", {
                  brandName,
                  brandId,
                })}`
              )
            }
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
