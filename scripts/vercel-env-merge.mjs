#!/usr/bin/env node

import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    target: ".env.local",
    environment: "development",
  };

  for (let i = 0; i < args.length; i += 1) {
    if ((args[i] === "--target" || args[i] === "-t") && args[i + 1]) {
      options.target = args[i + 1];
      i += 1;
      continue;
    }

    if ((args[i] === "--environment" || args[i] === "-e") && args[i + 1]) {
      options.environment = args[i + 1];
      i += 1;
    }
  }

  return options;
}

function collectKeys(content) {
  const keys = new Set();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) {
      keys.add(match[1]);
    }
  }

  return keys;
}

function collectMissingLines(pulledContent, existingKeys) {
  const missing = [];

  for (const line of pulledContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) continue;

    if (!existingKeys.has(match[1])) {
      missing.push(line);
    }
  }

  return missing;
}

const { target, environment } = parseArgs(process.argv);
const tempDir = mkdtempSync(path.join(tmpdir(), "vercel-env-merge-"));
const pulledPath = path.join(tempDir, "pulled.env");

const pull = spawnSync(
  "vercel",
  ["env", "pull", pulledPath, "--environment", environment],
  {
    stdio: "inherit",
  }
);

if (pull.status !== 0) {
  process.exit(pull.status ?? 1);
}

const existingContent = existsSync(target) ? readFileSync(target, "utf8") : "";
const pulledContent = readFileSync(pulledPath, "utf8");

const existingKeys = collectKeys(existingContent);
const missingLines = collectMissingLines(pulledContent, existingKeys);

if (missingLines.length === 0) {
  console.log(`No missing keys found. Left ${target} unchanged.`);
  process.exit(0);
}

const prefix = existingContent.trimEnd();
const merged = [
  prefix,
  prefix ? "" : null,
  `# Added from Vercel (${environment}) via scripts/vercel-env-merge.mjs`,
  ...missingLines,
  "",
]
  .filter((line) => line !== null)
  .join("\n");

writeFileSync(target, merged, "utf8");

console.log(
  `Added ${missingLines.length} missing key${missingLines.length === 1 ? "" : "s"} to ${target}.`
);
