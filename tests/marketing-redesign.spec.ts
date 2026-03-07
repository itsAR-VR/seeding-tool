import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const screenshotDir = path.resolve(process.cwd(), "tests/screenshots");
const bannedPhrases = [
  "request teardown",
  "book a teardown",
  "workflow teardown",
  "map this phase",
  "ai-powered",
  "intelligent automation",
];

async function recordScreenshot(page: Parameters<typeof test>[1]["page"], name: string) {
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: path.join(screenshotDir, name),
  });
}

test.describe("marketing redesign", () => {
  test("homepage route, copy, and screenshot are healthy", async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("404")) {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toHaveText("Run seeding like a channel, not a side project.");
    expect(consoleErrors).toEqual([]);

    if (testInfo.project.name === "desktop") {
      await expect(page.locator(".nav-toggle")).not.toBeVisible();
    } else {
      await expect(page.locator(".nav-toggle")).toBeVisible();
      await expect(page.locator('[aria-label="Mobile primary CTA"]')).toHaveCount(0);
    }

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    bannedPhrases.forEach((phrase) => {
      expect(bodyText).not.toContain(phrase);
    });

    await recordScreenshot(page, `home-${testInfo.project.name}.png`);
  });

  test("pricing route renders as a decision page and captures screenshots", async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("404")) {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toHaveText(
      "Choose the rollout path that matches how much seeding you run today.",
    );
    expect(consoleErrors).toEqual([]);

    const cards = page.locator(".decision-card");
    await expect(cards).toHaveCount(3);

    const boxes = await cards.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      }),
    );

    if (testInfo.project.name === "desktop") {
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(20);
      expect(Math.abs(boxes[1].y - boxes[2].y)).toBeLessThan(20);
    } else {
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y + 40);
      await expect(page.locator('[aria-label="Mobile primary CTA"]')).toHaveCount(0);
    }

    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    bannedPhrases.forEach((phrase) => {
      expect(bodyText).not.toContain(phrase);
    });

    await recordScreenshot(page, `pricing-${testInfo.project.name}.png`);
  });

  test("mobile first viewport stays calm", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only behavior");

    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[aria-label="Mobile primary CTA"]')).toHaveCount(0);
  });

  test("reduced motion keeps hero content visible", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const hiddenRevealCount = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-reveal]")].filter(
          (node) => getComputedStyle(node as Element).opacity === "0",
        ).length,
    );

    expect(hiddenRevealCount).toBe(0);
  });

  test("forms submit and show success state", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("#home-lead-form input[name='name']").fill("Jane");
    await page.locator("#home-lead-form input[name='email']").fill("jane@example.com");
    await page.locator("#home-lead-form button[type='submit']").click();
    await expect(page.locator("#home-lead-form").locator("..").locator(".form-state-success")).toContainText(
      "Thanks. We got it",
    );

    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    await page.locator("#pricing-contact-form input[name='name']").fill("Jane");
    await page.locator("#pricing-contact-form input[name='email']").fill("jane@example.com");
    await page.locator("#pricing-contact-form button[type='submit']").click();
    await expect(
      page.locator("#pricing-contact-form").locator("..").locator(".form-state-success"),
    ).toContainText("Thanks. We got it");
  });
});
