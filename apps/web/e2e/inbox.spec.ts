import { test, expect } from "@playwright/test";

/**
 * Inbox E2E:
 *   thread list renders → thread detail renders → draft review UI visible
 *
 * SKIP: requires live Supabase Auth + Gmail integration — run manually.
 */

test.describe("Inbox", () => {
  test.skip(
    () => !process.env.SUPABASE_E2E_ENABLED,
    "SKIP: requires live Supabase Auth — set SUPABASE_E2E_ENABLED=1 to run"
  );

  test("thread list renders", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByText(/inbox/i)).toBeVisible();

    // Should render thread list area (even if empty)
    await expect(page.locator("main")).toBeVisible();
  });

  test("thread detail renders with messages", async ({ page }) => {
    await page.goto("/inbox");

    // Click on a thread (if any exist)
    const firstThread = page.locator("[data-testid='thread-item'], a[href*='/inbox/']").first();
    if (await firstThread.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstThread.click();

      // Should show thread detail with messages
      await page.waitForURL("**/inbox/**");
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("draft review UI visible when drafts exist", async ({ page }) => {
    // SKIP: requires live Gmail integration — drafts must exist in DB
    test.skip(
      !process.env.GMAIL_E2E_ENABLED,
      "SKIP: requires live Gmail integration — set GMAIL_E2E_ENABLED=1 to run"
    );

    await page.goto("/inbox");

    // Look for draft indicator badge
    const draftBadge = page.getByText(/draft/i).first();
    if (await draftBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click thread with draft
      const draftThread = draftBadge.locator("..").locator("a, [data-testid='thread-item']").first();
      if (await draftThread.isVisible()) {
        await draftThread.click();

        // Should show draft review UI with Send/Discard buttons
        await expect(
          page.getByRole("button", { name: /send|approve/i })
        ).toBeVisible({ timeout: 5000 });
        await expect(
          page.getByRole("button", { name: /discard/i })
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
