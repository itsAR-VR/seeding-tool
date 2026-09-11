import { spawnSync } from "node:child_process";

const buildEnvironment = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://build:build@127.0.0.1:5432/seed_scale_build",
  OPENAI_API_KEY:
    process.env.OPENAI_API_KEY ?? "build-only-openai-placeholder",
  STRIPE_SECRET_KEY:
    process.env.STRIPE_SECRET_KEY ?? "sk_test_build_only_placeholder",
};

const command = process.platform === "win32" ? "next.cmd" : "next";
const result = spawnSync(command, ["build"], {
  env: buildEnvironment,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
