import { expect } from "@playwright/test";
export async function verifySampleShop(
  page,
  { username, password },
  restart,
  onExit,
) {
  const read = async () => {
    for (let i = 0; i < 30; i++) {
      const r = await page.evaluate(() =>
        window.pos.call("snapshot", { page: 0, search: "" }),
      );
      if (r.error === "BUSY") {
        await page.waitForTimeout(100);
        continue;
      }
      expect(r.ok).toBe(true);
      return r.data;
    }
    throw new Error("Sample snapshot remained busy");
  };
  const before = await read();
  const enter = async () => {
    await page
      .getByRole("button", { name: "Open sample shop", exact: true })
      .click();
    const modal = page.getByRole("dialog", {
      name: "Open sample shop",
      exact: true,
    });
    await modal
      .getByRole("button", { name: "Open sample shop", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId("sample-mode")).toBeVisible();
  };
  await enter();
  const d = await read(),
    mmk = d.reports.find((r) => r.currency === "MMK");
  expect(d.demoMode).toBe(true);
  expect(d.inventory).toBe(28);
  expect(d.sales).toHaveLength(12);
  expect(d.repairs).toHaveLength(6);
  expect(d.lowStock).toHaveLength(5);
  expect(mmk.revenue).toBe(2730000);
  expect(mmk.gross).toBe(600000);
  expect(mmk.received).toBeGreaterThan(0);
  const boxes = await page
    .locator(".dashboard-tables .panel")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
  expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(width);
  }
  const expense = await page.evaluate(() =>
    window.pos.call("expense", {
      request: crypto.randomUUID(),
      category: "Demo practice",
      description: "Temporary only",
      amount: 1234,
      currency: "MMK",
      method: "Cash",
    }),
  );
  expect(expense.ok).toBe(true);
  const blocked = await page.evaluate(() => window.pos.call("backup"));
  expect(blocked.error).toBe("DEMO_RESTRICTED");
  await page
    .getByTestId("sample-mode")
    .getByRole("button", { name: "Return to my shop", exact: true })
    .click();
  const exit = page.getByRole("dialog", {
    name: "Return to my shop",
    exact: true,
  });
  await exit
    .getByRole("button", { name: "Return to my shop", exact: true })
    .click();
  await expect(exit).toHaveCount(0);
  await expect(page.getByTestId("sample-mode")).toHaveCount(0);
  const live = await read();
  expect(live.demoMode).toBe(false);
  expect(live.sales).toEqual(before.sales);
  expect(live.expenses).toEqual(before.expenses);
  expect(live.inventory).toBe(before.inventory);
  if (onExit) await onExit();
  await enter();
  if (restart) page = await restart();
  else await page.reload();
  await page.waitForFunction(() => !!window.pos);
  await page.getByRole("combobox").first().selectOption("en-US");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByLabel("Password (10+ characters)", { exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const restarted = await read();
  expect(restarted.demoMode).toBe(false);
  expect(restarted.sales).toEqual(before.sales);
  expect(restarted.inventory).toBe(before.inventory);
  console.log(
    "PASS: functional 100-product sample shop with nonzero sales/profit/collections/stock/repairs, stacked dashboard tables, practice-write isolation, explicit exit and restart into unchanged live data.",
  );
  return page;
}
