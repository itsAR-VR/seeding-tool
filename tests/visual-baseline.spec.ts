import { test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baselineDir = path.resolve(process.cwd(), "tests/screenshots/baseline");

async function capture(page: Parameters<typeof test>[1]["page"], name: string) {
  await fs.mkdir(baselineDir, { recursive: true });
  await page.screenshot({ fullPage: true, path: path.join(baselineDir, name) });
}

test.describe("visual baseline", () => {
  test("home full page", async ({ page }, info) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await capture(page, `home-full-${info.project.name}.png`);
  });

  test("pricing full page", async ({ page }, info) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    await capture(page, `pricing-full-${info.project.name}.png`);
  });

  test("home sections", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop-only section shots");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    for (const id of ["workflow", "intelligence", "proof", "contact"]) {
      const el = page.locator(`#${id}, [aria-label="${id}"], .${id}`).first();
      if (await el.isVisible()) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await capture(page, `home-section-${id}.png`);
      }
    }
  });

  test("pricing sections", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop-only section shots");
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    for (const id of ["plans", "fit", "pricing-contact"]) {
      const el = page.locator(`#${id}`).first();
      if (await el.isVisible()) {
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await capture(page, `pricing-section-${id}.png`);
      }
    }
  });
});
