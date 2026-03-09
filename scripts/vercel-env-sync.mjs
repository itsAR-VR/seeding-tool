#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    source: ".env.local",
    environment: "development",
  };

  for (let i = 0; i < args.length; i += 1) {
    if ((args[i] === "--source" || args[i] === "-s") && args[i + 1]) {
      options.source = args[i + 1];
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

function parseEnv(content) {
  const map = new Map();

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    if (key === "VERCEL_OIDC_TOKEN") continue;

    map.set(key, value);
  }

  return map;
}

function run(command, args, input) {
  return spawnSync(command, args, {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function buildArgs(key, environment, isExisting) {
  const args = isExisting
    ? ["env", "update", key, environment, "--yes"]
    : ["env", "add", key, environment];

  if (environment !== "development") {
    args.push("--sensitive");
  }

  return args;
}

const { source, environment } = parseArgs(process.argv);

if (!existsSync(source)) {
  console.error(`Source file not found: ${source}`);
  process.exit(1);
}

const envMap = parseEnv(readFileSync(source, "utf8"));
const keys = [...envMap.keys()];

if (keys.length === 0) {
  console.log(`No syncable variables found in ${source}.`);
  process.exit(0);
}

const list = run("vercel", ["env", "list", environment], undefined);
if (list.status !== 0) {
  process.stderr.write(list.stderr || list.stdout || "");
  process.exit(list.status ?? 1);
}

const existing = new Set(
  keys.filter((key) => (list.stdout || "").includes(`${key} `))
);

let added = 0;
let updated = 0;

for (const key of keys) {
  const value = envMap.get(key) ?? "";
  const isExisting = existing.has(key);

  const args = buildArgs(key, environment, isExisting);

  const result = run("vercel", args, `${value}\n`);

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "");
    process.exit(result.status ?? 1);
  }

  if (isExisting) {
    updated += 1;
  } else {
    added += 1;
  }
}

console.log(
  `Synced ${keys.length} variables from ${source} to Vercel ${environment} (${added} added, ${updated} updated).`
);
