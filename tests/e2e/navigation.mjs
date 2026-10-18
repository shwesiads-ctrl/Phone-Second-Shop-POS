import { expect } from "@playwright/test";
export async function openNavigation(page) {
  // Login resolves before React mounts navigation; wait before checking its trigger.
  await page.locator("nav").waitFor({ state: "attached" });
  const toggle = page.getByTestId("menu-toggle");
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) !== "true"
  )
    await toggle.click();
}
export async function closeNavigation(page) {
  const toggle = page.getByTestId("menu-toggle");
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "true"
  )
    await page.locator("aside .drawer-close").click();
}
export async function navigateTo(page, target) {
  await openNavigation(page);
  const nav = page.locator("nav");
  await (
    typeof target === "number"
      ? nav.locator("button").nth(target)
      : nav.getByRole("button", { name: target, exact: true })
  ).click();
  const toggle = page.getByTestId("menu-toggle");
  if (await toggle.isVisible())
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
}
