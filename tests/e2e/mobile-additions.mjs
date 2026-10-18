import { navigateTo, openNavigation, closeNavigation } from "./navigation.mjs";
import { expect } from "@playwright/test";
export async function verifyMobileAdditions(page, mocked = false) {
  await navigateTo(page, "Accessories");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("SKU", { exact: true }).fill("UNCHANGED-SKU");
  const barcode = dialog.getByLabel("Barcode", { exact: true });
  await barcode
    .locator("..")
    .getByRole("button", { name: "Generate barcode", exact: true })
    .click();
  expect(await barcode.inputValue()).toMatch(/^P2\d{12}$/);
  await expect(dialog.getByLabel("SKU", { exact: true })).toHaveValue(
    "UNCHANGED-SKU",
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await navigateTo(page, "Settings");
  await expect(
    page.getByRole("heading", {
      name: "Customization / new feature",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Telegram · @kominit", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Printer status", exact: true })
    .click();
  const printerPanel = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Bluetooth POS printer",
      exact: true,
    }),
  });
  await expect(printerPanel.getByRole("status")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Printer status", exact: true }),
  ).toBeEnabled();
  const test = page.getByRole("button", {
    name: "Test print preview",
    exact: true,
  });
  await expect(test).toBeDisabled();
  const disconnected = await page.evaluate(() =>
    window.pos.call("printer", { action: "test", paper: "58mm" }),
  );
  expect(disconnected.error).toBe("PRINTER_NOT_CONNECTED");
  if (mocked) {
    await page
      .getByRole("button", { name: "Search printers", exact: true })
      .click();
    await expect(page.getByText(/Synthetic ESC\/POS/)).toBeVisible();
    await page
      .getByRole("button", { name: "Connect printer", exact: true })
      .click();
    await expect(test).toBeEnabled();
    await test.click();
    const preview = await page.evaluate(() =>
      window.androidHarness.previews.at(-1),
    );
    expect(preview.html).toContain("Test receipt");
    expect(preview.html).not.toMatch(/[\u1000-\u109f\u0e00-\u0e7f]/);
    await page
      .getByRole("button", { name: "Disconnect printer", exact: true })
      .click();
    await expect(test).toBeDisabled();
    await page
      .getByRole("button", { name: "Telegram · @kominit", exact: true })
      .click();
    expect(await page.evaluate(() => window.androidHarness.supportCalls)).toBe(
      1,
    );
  }
  await navigateTo(page, 0);
  console.log(
    mocked
      ? "PASS: barcode generator UI, customization/support action and search/connect/disconnect/test preview using substituted printer transport; physical hardware pending."
      : "PASS: barcode generator UI, customization link, real native Bluetooth status and disconnected-print refusal; physical printer pending.",
  );
}
