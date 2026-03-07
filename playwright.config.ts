import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  retries: 1,
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: process.env.HEADED !== "true",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 } },
    },
    // Phase 9h: E2E specs for platform flows
    {
      name: "e2e-platform",
      testDir: "./apps/web/e2e",
      use: {
        baseURL: "http://localhost:3000",
        viewport: { width: 1440, height: 900 },
        headless: process.env.HEADED !== "true",
        trace: "on-first-retry",
      },
    },
  ],
  webServer: {
    command: "npm run web:start",
    reuseExistingServer: true,
    timeout: 120000,
    url: "http://127.0.0.1:3000",
  },
});
