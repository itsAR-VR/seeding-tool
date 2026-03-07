import { test, expect } from "@playwright/test";

/**
 * Campaign CRUD E2E:
 *   create campaign → view detail
 *
 * SKIP: requires live Supabase Auth — run manually.
 */

test.describe("Campaigns", () => {
  test.skip(
    () => !process.env.SUPABASE_E2E_ENABLED,
    "SKIP: requires live Supabase Auth — set SUPABASE_E2E_ENABLED=1 to run"
  );

  test("create campaign → view detail page", async ({ page }) => {
    // Assume user is already logged in (session cookie set by fixture)
    await page.goto("/campaigns");
    await expect(page.getByText(/campaigns/i)).toBeVisible();

    // Click "New Campaign"
    await page.getByRole("link", { name: /new campaign|create/i }).click();
    await page.waitForURL("**/campaigns/new**");

    // Fill campaign form
    await page.getByLabel(/name/i).fill("Summer Seeding 2025");
    const descField = page.getByLabel(/description/i);
    if (await descField.isVisible()) {
      await descField.fill("Summer product seeding campaign");
    }

    // Submit
    await page.getByRole("button", { name: /create|save/i }).click();

    // Should redirect to campaign detail
    await page.waitForURL("**/campaigns/**");
    await expect(page.getByText("Summer Seeding 2025")).toBeVisible();
  });
});
