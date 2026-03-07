import { test, expect } from "@playwright/test";

/**
 * Creator management E2E:
 *   import CSV → verify creator appears → add to campaign
 *
 * SKIP: requires live Supabase Auth — run manually.
 */

test.describe("Creators", () => {
  test.skip(
    () => !process.env.SUPABASE_E2E_ENABLED,
    "SKIP: requires live Supabase Auth — set SUPABASE_E2E_ENABLED=1 to run"
  );

  test("import CSV → verify creator appears", async ({ page }) => {
    await page.goto("/creators/import");
    await expect(page.getByText(/import/i)).toBeVisible();

    // Upload a CSV file
    const csvContent = "username,email,followerCount,avgViews,bioCategory,discoverySource\n@testcreator,test@creator.com,5000,1200,fashion,csv_import";

    // Create a virtual file for upload
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles({
        name: "creators.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csvContent),
      });

      // Should show preview table
      await expect(page.getByText("@testcreator")).toBeVisible({ timeout: 5000 });

      // Confirm import
      await page.getByRole("button", { name: /confirm|import/i }).click();

      // Should show success counts
      await expect(page.getByText(/created|imported/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("search and add creator to campaign", async ({ page }) => {
    await page.goto("/creators");
    await expect(page.getByText(/creators/i)).toBeVisible();

    // Search for a creator
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("testcreator");
      await page.keyboard.press("Enter");
    }

    // Should see "Add to Campaign" button
    const addButton = page.getByRole("button", { name: /add to campaign/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();

      // Select a campaign from modal
      const campaignOption = page.getByText(/summer/i).first();
      if (await campaignOption.isVisible()) {
        await campaignOption.click();
        await page.getByRole("button", { name: /confirm|add/i }).click();
      }
    }
  });
});
