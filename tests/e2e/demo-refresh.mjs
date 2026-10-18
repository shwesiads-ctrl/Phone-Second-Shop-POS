import { expect } from "@playwright/test";
import { navigateTo } from "./navigation.mjs";
export async function verifyDemoRefresh(page, nativeBack) {
  await navigateTo(page, "Settings");
  const action = async (name) => {
    await page.getByRole("button", { name, exact: true }).click();
    const modal = page.getByRole("dialog", { name, exact: true });
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name, exact: true }).click();
    await expect(modal).toHaveCount(0);
  };
  // Exercise the actual in-app dialog: no window.confirm override or automatic acceptance.
  await page
    .getByRole("button", { name: "Add 100 demo items", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  if (nativeBack) await nativeBack();
  else await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("demo-count")).toHaveText("0");
  await page.locator(".toolbar form input").fill("THIS-FILTER-HIDES-DEMO");
  await page.locator(".toolbar form button").click();
  await page.locator(".toolbar input[type=date]").first().fill("2099-01-01");
  await action("Add 100 demo items");
  await expect(
    page.getByRole("heading", { name: "Accessories", exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".toolbar form input")).toHaveValue("");
  await expect(page.locator(".toolbar input[type=date]").first()).toHaveValue(
    "",
  );
  await expect(page.getByText(/\[DEMO\]/).first()).toBeVisible();
  const snapshot = await page.evaluate(() => window.pos.call("snapshot"));
  expect(snapshot.ok).toBe(true);
  expect(snapshot.data.settings.demoInventory).toHaveLength(100);
  await navigateTo(page, "Settings");
  await expect(page.getByTestId("demo-count")).toHaveText("100");
  await action("Remove demo items");
  await expect(page.getByTestId("demo-count")).toHaveText("0");
  await action("Add 100 demo items");
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
  await navigateTo(page, 0);
  console.log(
    "PASS: real demo dialog cancel/confirm (no native-dialog mock), 100 items automatically visible despite old filters, demo count, removal and pull refresh. Physical swipe pending.",
  );
}
