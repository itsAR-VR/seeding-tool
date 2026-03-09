import { expect, test } from "@playwright/test";

test.describe("hero media stage", () => {
  test("desktop carousel advances and docks into the mentions area below the hero", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only interaction");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const stage = page.locator("[data-hero-stage]");
    const dashboard = page.locator("[data-dashboard-showcase]");
    const proofRail = page.locator(".proof-rail");

    await expect(stage).toHaveAttribute("data-hero-state", "carousel");
    await expect(page.locator("[data-hero-reel]")).toHaveCount(6);
    await expect(dashboard).toBeVisible();

    const dashboardBox = await dashboard.boundingBox();
    const proofBox = await proofRail.boundingBox();
    expect(dashboardBox).not.toBeNull();
    expect(proofBox).not.toBeNull();
    expect((proofBox?.y ?? 0)).toBeGreaterThan((dashboardBox?.y ?? 0) + 200);

    const initialIndex = await stage.getAttribute("data-hero-active-index");
    await page.waitForTimeout(4700);
    const nextIndex = await stage.getAttribute("data-hero-active-index");
    expect(nextIndex).not.toBe(initialIndex);

    await page.evaluate(() => {
      const root = document.querySelector("[data-hero-stage]");
      if (!root) {
        return;
      }

      const top = root.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + window.innerHeight, behavior: "auto" });
    });

    await page.waitForTimeout(450);

    await expect(stage).toHaveAttribute("data-hero-state", "docked");
    const progress = await stage.getAttribute("data-transition-progress");
    expect(Number(progress)).toBeGreaterThan(0.95);

    const dockedCards = await page.locator("[data-hero-reel]").evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            opacity: Number(getComputedStyle(node).opacity),
            top: rect.top,
            width: rect.width,
          };
        })
        .filter((box) => box.opacity > 0.45 && box.width > 40),
    );

    expect(dockedCards).toHaveLength(4);

    const mentionGrid = await page.locator("[data-mentions-slot]").first().evaluate((node) => {
      const parent = node.parentElement;
      if (!parent) {
        throw new Error("mentions grid missing");
      }

      const rect = parent.getBoundingClientRect();
      return { bottom: rect.bottom, top: rect.top };
    });

    dockedCards.forEach((card) => {
      expect(card.top).toBeGreaterThan(mentionGrid.top - 28);
      expect(card.bottom).toBeLessThan(mentionGrid.bottom + 28);
    });
  });

  test("dock stays inside the actual mention slots across key breakpoints", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "run once from desktop project");

    const viewports = [
      { expectedSlots: 4, height: 860, width: 1024 },
      { expectedSlots: 2, height: 820, width: 900 },
      { expectedSlots: 2, height: 820, width: 768 },
      { expectedSlots: 2, height: 844, width: 390 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await page.evaluate(() => {
        const root = document.querySelector("[data-hero-stage]");
        if (!root) {
          return;
        }

        const top = root.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + window.innerHeight * 1.1, behavior: "auto" });
      });

      await page.waitForTimeout(450);

      const stage = page.locator("[data-hero-stage]");
      const progress = Number(await stage.getAttribute("data-transition-progress"));
      expect(progress).toBeGreaterThan(0.92);

      const slots = await page.locator("[data-mentions-slot]").evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              bottom: rect.bottom,
              centerX: rect.left + rect.width / 2,
              centerY: rect.top + rect.height / 2,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            };
          })
          .sort((left, right) => left.centerX - right.centerX || left.centerY - right.centerY),
      );

      expect(slots).toHaveLength(viewport.expectedSlots);

      const cards = await page.locator("[data-hero-reel]").evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const rect = node.getBoundingClientRect();
            const opacity = Number(getComputedStyle(node).opacity);
            return {
              bottom: rect.bottom,
              centerX: rect.left + rect.width / 2,
              centerY: rect.top + rect.height / 2,
              height: rect.height,
              opacity,
              width: rect.width,
            };
          })
          .filter((card) => card.opacity > 0.45 && card.width > 30)
          .sort((left, right) => left.centerX - right.centerX || left.centerY - right.centerY),
      );

      expect(cards).toHaveLength(viewport.expectedSlots);

      cards.forEach((card, index) => {
        const slot = slots[index];
        expect(card.centerX).toBeGreaterThanOrEqual(slot.left);
        expect(card.centerX).toBeLessThanOrEqual(slot.right);
        expect(card.centerY).toBeGreaterThanOrEqual(slot.top);
        expect(card.centerY).toBeLessThanOrEqual(slot.bottom);
        expect(card.width).toBeLessThanOrEqual(slot.width - 8);
        expect(card.height).toBeLessThanOrEqual(slot.height - 8);
        expect(card.centerX).toBeGreaterThan(slot.centerX);
      });
    }
  });

  test("mobile hero keeps one dominant reel, one preview, and a simplified dock", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only layout");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cards = page.locator("[data-hero-reel]");
    await expect(cards).toHaveCount(6);
    await expect(page.locator("[data-mentions-slot]")).toHaveCount(2);

    const carouselBox = await page.locator("[data-hero-carousel]").boundingBox();
    expect(carouselBox).not.toBeNull();
    expect(carouselBox?.y ?? 0).toBeLessThan(690);

    const visibleCards = await cards.evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: rect.left,
            opacity: Number(getComputedStyle(node).opacity),
            width: rect.width,
          };
        })
        .filter((box) => box.opacity >= 0.1 && box.width > 30)
        .sort((left, right) => right.width - left.width),
    );

    expect(visibleCards[0]?.width ?? 0).toBeGreaterThan(130);
    expect(visibleCards[1]?.width ?? 0).toBeGreaterThan(85);
    expect(visibleCards[1]?.left ?? 0).toBeGreaterThan((visibleCards[0]?.left ?? 0) + 20);
  });

  test("reduced motion keeps hero and dashboard separate with no travel animation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop-only reduced motion check");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const stage = page.locator("[data-hero-stage]");
    await expect(stage).toHaveAttribute("data-hero-state", "reduced");
    await expect(page.locator("[data-hero-reel]")).toHaveCount(4);
    await expect(page.locator("[data-dashboard-showcase]")).toBeVisible();
    await expect(page.locator("[data-mentions-slot]")).toHaveCount(4);

    const progress = await stage.getAttribute("data-transition-progress");
    expect(Number(progress)).toBe(0);
  });
});
