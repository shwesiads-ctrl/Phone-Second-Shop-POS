import { expect } from "@playwright/test";
import { navigateTo } from "./navigation.mjs";
export async function verifyDemoRefresh(page) {
  await navigateTo(page, "Settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Add 100 demo items", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add 100 demo items", exact: true }),
  ).toBeEnabled();
  const snapshot = await page.evaluate(() => window.pos.call("snapshot"));
  expect(snapshot.ok).toBe(true);
  expect(snapshot.data.settings.demoInventory).toHaveLength(100);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Remove demo items", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove demo items", exact: true }),
  ).toBeEnabled();
  expect(
    (await page.evaluate(() => window.pos.call("snapshot"))).data.settings
      .demoInventory,
  ).toBeUndefined();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Add 100 demo items", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add 100 demo items", exact: true }),
  ).toBeEnabled();
  await navigateTo(page, "Accessories");
  await expect(page.getByText(/\[DEMO\]/).first()).toBeVisible();
  const removed = await page.evaluate(() =>
    window.pos.call("demoInventory", { action: "remove" }),
  );
  expect(removed.ok).toBe(true);
  expect(removed.data.count).toBe(100);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const target = document.querySelector(".page-title");
    const touch = (y) =>
      new Touch({ identifier: 1, target, clientX: 150, clientY: y });
    target.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        touches: [touch(15)],
        changedTouches: [touch(15)],
      }),
    );
    target.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        touches: [touch(125)],
        changedTouches: [touch(125)],
      }),
    );
    target.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        touches: [],
        changedTouches: [touch(125)],
      }),
    );
  });
  await expect(page.getByText(/\[DEMO\]/)).toHaveCount(0);
  await navigateTo(page, "Settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Remove demo items", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove demo items", exact: true }),
  ).toBeEnabled();
  await navigateTo(page, 0);
  console.log(
    "PASS: Owner adds 100 demo items, cleanup removes only samples, pull gesture refreshes stale inventory without reloading the app. Physical swipe pending.",
  );
}
