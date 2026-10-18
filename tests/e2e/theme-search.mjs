import { expect } from "@playwright/test";
export async function verifyThemePreference(page) {
  const root = page.locator("html"),
    toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toBeVisible();
  if ((await root.getAttribute("data-theme")) === "dark") await toggle.click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement),
      input = getComputedStyle(document.querySelector("input,select"));
    return {
      background: style.backgroundColor,
      scheme: style.colorScheme,
      field: input.backgroundColor,
      text: input.color,
    };
  });
  expect(colors.background).toBe("rgb(16, 24, 35)");
  expect(colors.scheme).toBe("dark");
  expect(colors.field).toBe("rgb(27, 38, 53)");
  // Verify real preference persistence on the setup/login screen, without changing shop data.
  await page.reload();
  await page.waitForFunction(() => !!window.pos);
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("theme-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("theme-toggle").click();
  await expect(root).toHaveAttribute("data-theme", "light");
  console.log(
    "PASS: day/night toggle, dark native-control color scheme, saved preference across reload and return to day mode.",
  );
}
export async function verifySearchIcon(page) {
  const button = page.locator(".toolbar form button");
  await expect(button).toHaveAccessibleName(/.+/);
  await expect(button.locator("svg")).toHaveAttribute("stroke-width", "2.25");
  await expect(button.locator("svg")).toHaveAttribute("width", "20");
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}
