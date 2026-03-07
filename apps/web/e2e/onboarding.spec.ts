import { test, expect } from "@playwright/test";

/**
 * Onboarding E2E flow:
 *   signup → brand step → connect step → dashboard lands
 *
 * SKIP: requires Supabase Auth running locally.
 * To run: start local Supabase, set NEXT_PUBLIC_SUPABASE_URL + ANON_KEY, then run:
 *   npx playwright test apps/web/e2e/onboarding.spec.ts
 */

test.describe("Onboarding flow", () => {
  // SKIP: requires live Supabase Auth — run manually with local Supabase
  test.skip(
    () => !process.env.SUPABASE_E2E_ENABLED,
    "SKIP: requires live Supabase Auth — set SUPABASE_E2E_ENABLED=1 to run"
  );

  test("signup → brand step → connect step → dashboard", async ({ page }) => {
    // 1. Navigate to signup
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 2. Fill email and password
    await page.getByLabel("Email").fill("e2e-test@example.com");
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: /sign up|create account/i }).click();

    // 3. Wait for redirect to onboarding
    await page.waitForURL("**/onboarding**", { timeout: 10000 });
    await expect(page).toHaveURL(/onboarding/);

    // 4. Brand step — fill brand info
    const brandNameInput = page.getByLabel(/brand name/i);
    if (await brandNameInput.isVisible()) {
      await brandNameInput.fill("E2E Test Brand");
      await page.getByRole("button", { name: /next|continue/i }).click();
    }

    // 5. Connect step — skip integrations for now
    const skipButton = page.getByRole("button", { name: /skip|later/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }

    // 6. Should land on dashboard
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });
});
