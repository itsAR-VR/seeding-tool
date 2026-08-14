"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HARD_MAX_PROFILES, type DiscoveryRunMode } from "@/lib/suggested-discovery/types";

interface RunFormProps {
  onStarted: (runId: string) => void;
}

export function RunForm({ onStarted }: RunFormProps) {
  const [seedHandle, setSeedHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [maxProfiles, setMaxProfiles] = useState(12);
  const [mode, setMode] = useState<DiscoveryRunMode>("demo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/discover/suggested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedHandle,
          niche,
          maxProfiles,
          mode,
        }),
      });
      const payload = (await response.json()) as {
        run?: { id: string };
        error?: string;
      };
      if (!response.ok || !payload.run) {
        setError(payload.error ?? "Failed to start run");
        return;
      }
      onStarted(payload.run.id);
    } catch {
      setError("Network error starting run");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New discovery run</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seed-handle">Seed profile</Label>
            <Input
              id="seed-handle"
              placeholder="@brandorfounder"
              value={seedHandle}
              onChange={(event) => setSeedHandle(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Instagram walks the &quot;Suggested for you&quot; rail on this profile.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="niche">Niche brief</Label>
            <Textarea
              id="niche"
              placeholder="e.g. clean skincare creators with engaged US audiences, 10k-200k followers"
              value={niche}
              onChange={(event) => setNiche(event.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="max-profiles">Max profiles</Label>
              <Input
                id="max-profiles"
                type="number"
                min={1}
                max={HARD_MAX_PROFILES}
                value={maxProfiles}
                onChange={(event) => setMaxProfiles(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as DiscoveryRunMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo (fixtures)</SelectItem>
                  <SelectItem value="live">Live (Instagram)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "live" && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Live mode needs a logged-in Instagram session on this machine:
              run <code>npm run discover:suggested -- --login</code> once.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Starting…" : "Start discovery"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
