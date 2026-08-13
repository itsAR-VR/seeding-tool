"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DoneStep() {
  const router = useRouter();
  const calledRef = useRef(false);
  const [completing, setCompleting] = useState(true);
  const [error, setError] = useState("");

  // Mark onboarding complete on mount (idempotent)
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function markComplete() {
      try {
        const response = await fetch("/api/onboarding/complete", {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to complete onboarding");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to complete onboarding"
        );
      } finally {
        setCompleting(false);
      }
    }

    markComplete();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re all set!</CardTitle>
        <CardDescription>
          Your brand and discovery automation are ready. Head to the dashboard
          to start using the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <Button
          className="w-full"
          disabled={completing}
          onClick={() => router.push("/dashboard")}
        >
          {completing ? "Finishing setup..." : "Go to Dashboard"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You can manage connections anytime from Settings &rarr; Connections.
        </p>
      </CardContent>
    </Card>
  );
}
