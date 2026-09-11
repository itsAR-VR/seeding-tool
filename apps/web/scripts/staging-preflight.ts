import process from "node:process";

import {
  formatStagingPreflightResult,
  runStagingPreflight,
} from "@/lib/config/staging-preflight";

const args = new Set(process.argv.slice(2));
const result = runStagingPreflight();

if (args.has("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  process.stdout.write(`${formatStagingPreflightResult(result)}\n`);
}

if (args.has("--strict") && !result.ready) {
  process.exitCode = 1;
}
