import { expect } from "@playwright/test";
import { navigateTo } from "./navigation.mjs";
export async function verifyNamedDemo(page) {
  await navigateTo(page, "Settings");
  const panel = page.getByTestId("named-demo-settings");
  await panel
    .getByRole("button", {
      name: "Add 10 products + 10 customers",
      exact: true,
    })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Add 10 products + 10 customers",
    exact: true,
  });
  await dialog
    .getByRole("button", {
      name: "Add 10 products + 10 customers",
      exact: true,
    })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Accessories", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("[DEMO] Samsung 25W USB-C Charger", { exact: true }),
  ).toBeVisible();
  await navigateTo(page, "Customers & suppliers");
  await expect(page.getByText("[DEMO] Su Su", { exact: true })).toBeVisible();
  await navigateTo(page, "Settings");
  await expect(panel).toContainText("Accessories: 10");
  await expect(panel).toContainText("Customers: 10");
  await panel
    .getByRole("button", { name: "Remove named demo data", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Remove named demo data",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Remove named demo data", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(panel).toContainText("Accessories: 0");
  await expect(panel).toContainText("Customers: 0");
  console.log(
    "PASS: Settings named demo adds 10 recognizable products and 10 fictional customers, shows both destinations and removes the tracked batch.",
  );
}
