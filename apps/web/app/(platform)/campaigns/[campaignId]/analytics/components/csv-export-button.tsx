"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/analytics/csv-export";
import type { AnalyticsResponse } from "@/lib/analytics/types";
import { Button } from "@/components/ui/button";

type CSVExportButtonProps = {
  readonly campaignId: string;
  readonly campaignName: string;
};

export function CSVExportButton({
  campaignId,
  campaignName,
}: CSVExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/analytics`);
      if (!res.ok) {
        throw new Error("Couldn't export the results. Try again in a minute.");
      }
      const data = (await res.json()) as AnalyticsResponse;
      const safeName = campaignName.replace(/[^a-zA-Z0-9-_]/g, "_");
      downloadCSV(data, `${safeName}-analytics.csv`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't export the results. Try again."
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId, campaignName]);

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? "Downloading…" : "Download spreadsheet"}
    </Button>
  );
}
