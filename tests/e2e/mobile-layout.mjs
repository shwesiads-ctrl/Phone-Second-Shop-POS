import { expect } from "@playwright/test";
// Check actual rendered geometry: the fixed desktop header used to overlap the toolbar.
export async function verifyMobileLayout(page, prefix) {
  for (const language of ["en-US", "my-MM", "th-TH"]) {
    await page.locator(".header-actions select").selectOption(language);
    console.log(
      "Layout language",
      language,
      await page.evaluate(() => innerWidth),
    );
    for (const index of [0, 1, 2]) {
      await page.locator("nav button").nth(index).click();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        };
        const header = document.querySelector("header");
        return {
          header: rect(header),
          toolbar: rect(document.querySelector(".toolbar")),
          controls: [
            ...header.querySelectorAll("select,button,.user-badge"),
          ].map(rect),
          width: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          inputs: [...document.querySelectorAll(".toolbar input")].map(rect),
        };
      });
      expect(geometry.toolbar.top).toBeGreaterThanOrEqual(
        geometry.header.bottom,
      );
      for (const box of geometry.controls) {
        expect(box.bottom).toBeLessThanOrEqual(geometry.header.bottom);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(geometry.width);
      }
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
      for (const box of geometry.inputs) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(geometry.width);
      }
      if (prefix)
        await page.screenshot({
          path: `${prefix}-${language}-${index}.png`,
          fullPage: true,
        });
    }
  }
  await page.locator(".header-actions select").selectOption("en-US");
  await page.locator("nav button").first().click();
}
