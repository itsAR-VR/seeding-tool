"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ParsedRow = {
  username: string;
  email?: string;
  followerCount?: number;
  avgViews?: number;
  bioCategory?: string;
  discoverySource?: string;
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    const username = row["username"] || row["handle"] || row["instagram"] || "";
    if (!username) continue;

    rows.push({
      username: username.replace(/^@/, ""),
      email: row["email"] || undefined,
      followerCount: row["followercount"] || row["followers"]
        ? parseInt(row["followercount"] || row["followers"], 10) || undefined
        : undefined,
      avgViews: row["avgviews"] || row["views"]
        ? parseInt(row["avgviews"] || row["views"], 10) || undefined
        : undefined,
      bioCategory: row["biocategory"] || row["category"] || undefined,
      discoverySource:
        row["discoverysource"] || row["source"] || "csv_import",
    });
  }

  return rows;
}

export default function CreatorImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;

      setFile(f);
      setResult(null);
      setError(null);

      const text = await f.text();
      const rows = parseCSV(text);
      setParsedRows(rows);

      if (rows.length === 0) {
        setError(
          "No valid rows found. CSV must have a header row with at least a 'username' column."
        );
      }
    },
    []
  );

  async function handleImport() {
    if (parsedRows.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/creators/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Import failed");
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Network error during import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Creators</h1>
          <p className="text-muted-foreground">
            Upload a CSV file to bulk import creators into the platform.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/creators")}>
          ← Back to Creators
        </Button>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Your CSV should include a header row with these columns:
          </p>
          <code className="block rounded bg-muted p-2 text-xs">
            username, email, followerCount, avgViews, bioCategory, discoverySource
          </code>
          <p className="mt-2 text-xs text-muted-foreground">
            Only <strong>username</strong> is required. discoverySource defaults
            to &quot;csv_import&quot;.
          </p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
          />

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              ✅ Import complete — {result.created} created, {result.updated}{" "}
              updated, {result.skipped} skipped
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Table */}
      {parsedRows.length > 0 && !result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Preview ({parsedRows.length} rows)
              </CardTitle>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing…" : `Import ${parsedRows.length} Creators`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Username</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Followers</th>
                    <th className="pb-2 pr-4 font-medium">Avg Views</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">
                        @{row.username}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {row.email || "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {row.followerCount?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {row.avgViews?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {row.bioCategory || "—"}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {row.discoverySource || "csv_import"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 50 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first 50 of {parsedRows.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
