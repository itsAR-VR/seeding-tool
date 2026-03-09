import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function login(page: Page) {
  if (!APP_URL || !E2E_EMAIL || !E2E_PASSWORD) {
    test.skip(true, "Set NEXT_PUBLIC_APP_URL, E2E_EMAIL, and E2E_PASSWORD to run production cutover checks.");
  }

  await page.goto(`${APP_URL}/login`);
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/dashboard|onboarding/);
}

test.describe("Production cutover", () => {
  test("marketing homepage no longer shows example-logo proof rail", async ({ page }) => {
    test.skip(!APP_URL, "Set NEXT_PUBLIC_APP_URL to run production cutover checks.");

    await page.goto(APP_URL!);
    await expect(page.locator(".proof-rail")).toHaveCount(0);
  });

  test("authenticated shell shows logout and onboarding discovery flow", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();
    await page.goto(`${APP_URL}/onboarding?step=discovery`);
    await expect(page.getByText(/set up discovery/i)).toBeVisible();
    await expect(page.getByText("Apify")).toBeVisible();
    await expect(page.getByText("Collabstr")).toBeVisible();
  });

  test("connections page shows Gmail and Shopify status surfaces", async ({ page }) => {
    await login(page);

    await page.goto(`${APP_URL}/settings/connections`);
    await expect(page.getByRole("heading", { name: /connections/i })).toBeVisible();
    await expect(page.getByText(/gmail/i)).toBeVisible();
    await expect(page.getByText(/shopify/i)).toBeVisible();
  });

  test("campaign products page exposes synced catalog surface", async ({ page }) => {
    await login(page);

    test.fail(true, "Requires a known production campaign id before this check can run.");
  });
});
