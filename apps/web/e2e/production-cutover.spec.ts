import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const E2E_EMAIL = process.env.E2E_EMAIL ?? process.env.e2e_email;
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? process.env.e2e_password;

async function login(page: Page) {
  if (!APP_URL || !E2E_EMAIL || !E2E_PASSWORD) {
    test.skip(
      true,
      "Set NEXT_PUBLIC_APP_URL plus E2E_EMAIL/E2E_PASSWORD or e2e_email/e2e_password to run production cutover checks."
    );
  }

  await page.goto(`${APP_URL}/login`);
  await page.getByLabel(/email/i).fill(E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/dashboard|onboarding/);
}

async function getFirstCampaignId(page: Page) {
  const response = await page.request.get(`${APP_URL}/api/campaigns`);
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as
    | Array<{ id: string }>
    | { campaigns?: Array<{ id: string }> };

  const campaigns = Array.isArray(payload) ? payload : payload.campaigns ?? [];
  expect(campaigns.length).toBeGreaterThan(0);

  return campaigns[0]!.id;
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
    await page.getByLabel(/creators per day/i).fill("200");
    await expect(
      page.getByText(/Values above 100 are allowed/i)
    ).toBeVisible();
  });

  test("settings pages show automations and connection status surfaces", async ({
    page,
  }) => {
    await login(page);

    await page.goto(`${APP_URL}/settings/automations`);
    await expect(page.getByRole("heading", { name: /automations/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Discovery/i })).toBeVisible();
    await expect(page.getByText(/Apify: /i)).toBeVisible();
    await expect(page.getByText(/Collabstr: /i)).toBeVisible();
    await expect(page.getByText(/Creators per day:/i)).toBeVisible();

    await page.goto(`${APP_URL}/settings/connections`);
    await expect(page.getByRole("heading", { name: /connections/i })).toBeVisible();
    await expect(page.getByText("Gmail", { exact: true })).toBeVisible();
    await expect(page.getByText("Shopify", { exact: true })).toBeVisible();
  });

  test("campaign products page exposes sync state and campaign creators hide marketplace placeholders", async ({
    page,
  }) => {
    await login(page);

    const campaignId = await getFirstCampaignId(page);

    await page.goto(`${APP_URL}/campaigns/${campaignId}`);
    await expect(page.getByRole("heading", { name: /sleepkalm|mouth tape/i })).toBeVisible();
    await expect(page.getByText("1,500,000")).toHaveCount(0);

    await page.goto(`${APP_URL}/campaigns/${campaignId}/products`);
    await expect(page.getByRole("heading", { name: /campaign products/i })).toBeVisible();
    await page.getByRole("button", { name: /sync products from shopify/i }).click();
    await expect(page.getByPlaceholder(/search products/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /re-sync/i })).toBeVisible();
  });

  test("logout redirects back to login", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: /logout/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByText(/log in to seed scale/i)).toBeVisible();
  });
});
