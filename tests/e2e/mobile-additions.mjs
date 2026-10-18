import { expect } from "@playwright/test";
export async function verifyMobileAdditions(page, mocked = false) {
  await page
    .locator("nav")
    .getByRole("button", { name: "Accessories", exact: true })
    .click();
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
  await page
    .locator("nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
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
    expect(preview.html).toContain("မြန်မာ");
    expect(preview.html).toContain("ทดสอบ");
    expect(preview.html).toContain("TEST ONLY");
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
  await page.locator("nav button").first().click();
  console.log(
    mocked
      ? "PASS: barcode generator UI, customization/support action and search/connect/disconnect/test preview using substituted printer transport; physical hardware pending."
      : "PASS: barcode generator UI, customization link, real native Bluetooth status and disconnected-print refusal; physical printer pending.",
  );
}
