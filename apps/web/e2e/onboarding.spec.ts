import { test, expect } from "@playwright/test";

/**
 * Onboarding E2E flow:
 *   signup → brand analysis → Business DNA reveal → discovery step
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

  test("signup → brand step → Business DNA reveal → discovery", async ({ page }) => {
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

    // 4. Brand step — fill brand info and trigger analysis
    const brandNameInput = page.getByLabel(/brand name/i);
    if (await brandNameInput.isVisible()) {
      await brandNameInput.fill("E2E Test Brand");
      await page
        .getByLabel(/website url/i)
        .fill("https://sleepkalm.com");
      await page
        .getByRole("button", { name: /generate business dna/i })
        .click();
    }

    await expect(
      page.getByText(/composing your business dna|creating your brand/i)
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /your business dna/i })
    ).toBeVisible({ timeout: 40000 });

    await page
      .getByRole("button", { name: /continue to discovery/i })
      .click();

    await page.waitForURL("**/onboarding?step=discovery**", {
      timeout: 10000,
    });
    await expect(page).toHaveURL(/step=discovery/);
    await expect(
      page.getByRole("heading", { name: /set up discovery/i })
    ).toBeVisible();
  });
});
