"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { sourceLabel } from "../components/creator-filters";

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

type ImportResult = {
  requested: number;
  validImported: number;
  created: number;
  updated: number;
  invalidDropped: number;
  skipped: number;
};

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function resultSentences(result: ImportResult): string[] {
  const lines = [
    result.updated > 0
      ? `Added ${plural(result.created, "new creator", "new creators")} and updated ${result.updated.toLocaleString()} you already had.`
      : `Added ${plural(result.created, "new creator", "new creators")}.`,
  ];
  if (result.invalidDropped > 0) {
    lines.push(
      `${plural(result.invalidDropped, "handle wasn't", "handles weren't")} found on Instagram, so we left ${result.invalidDropped === 1 ? "it" : "them"} out. Check the spelling and import ${result.invalidDropped === 1 ? "it" : "them"} again.`
    );
  }
  if (result.skipped > 0) {
    lines.push(`${plural(result.skipped, "row had", "rows had")} no handle and ${result.skipped === 1 ? "was" : "were"} skipped.`);
  }
  return lines;
}

const COLUMN_HELP: Array<[string, string]> = [
  ["username", "Their Instagram handle. Required. You can also call this column handle or instagram."],
  ["email", "Their email, if you have it."],
  ["followers", "Follower count."],
  ["views", "Average views per reel."],
  ["category", "What they post about, like skincare or fitness."],
];

export default function CreatorImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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
          "We couldn't read any creators from that file. Make sure the first row has column names and one of them is username."
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
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" && data.error !== "Failed to import creators"
            ? `${data.error}. Fix the file and try again.`
            : "The import didn't finish. Try again in a minute."
        );
        return;
      }

      const data = (await res.json()) as ImportResult;
      setResult(data);
    } catch {
      setError("The import didn't finish. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/creators"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All creators
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Import a list</h1>
        <p className="text-muted-foreground">
          Add creators you already know from a spreadsheet. Save it as a CSV file first.
        </p>
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-5 py-4 font-semibold">Choose your file</h2>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label htmlFor="import-file" className="text-sm font-medium">
              CSV file
            </label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />
            {file && parsedRows.length > 0 && !result ? (
              <p className="text-sm text-muted-foreground">
                {file.name}: {plural(parsedRows.length, "creator", "creators")} ready to import.
              </p>
            ) : null}
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          )}

          {result && (
            <div role="status" className="space-y-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              <p className="font-medium">Import finished.</p>
              {resultSentences(result).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <Link href="/creators" className={`${buttonVariants({ variant: "outline" })} mt-2`}>
                See your creators
              </Link>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">What columns can the file have?</summary>
            <dl className="mt-2 divide-y rounded-lg border">
              {COLUMN_HELP.map(([col, help]) => (
                <div key={col} className="grid gap-1 px-3 py-2 sm:grid-cols-[120px_1fr]">
                  <dt className="font-mono">{col}</dt>
                  <dd className="text-muted-foreground">{help}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </section>

      {parsedRows.length > 0 && !result && (
        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <h2 className="font-semibold">Check before importing</h2>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${plural(parsedRows.length, "creator", "creators")}`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-3 pl-5 font-medium">Handle</th>
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Followers</th>
                  <th scope="col" className="px-4 py-3 font-medium">Average views</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 pr-5 font-medium">Found through</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parsedRows.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 pl-5">@{row.username}</td>
                    <td className="px-4 py-2.5">
                      {row.email || <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.followerCount?.toLocaleString() ?? <span className="text-muted-foreground">Unknown</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {row.avgViews?.toLocaleString() ?? <span className="text-muted-foreground">Unknown</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.bioCategory || <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="px-4 py-2.5 pr-5">{sourceLabel(row.discoverySource || "csv_import")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 50 && (
            <p className="border-t px-5 py-3 text-sm text-muted-foreground">
              Showing the first 50 of {parsedRows.length.toLocaleString()}. All of them will be imported.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
