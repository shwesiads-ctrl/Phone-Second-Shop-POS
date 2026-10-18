import { expect } from "@playwright/test";
// No screenshots, logs, or artifact files contain the generated recovery key.
export async function verifyOwnerRecovery(page, username, password) {
  try {
    await expect(
      page.locator("nav").getByRole("button", { name: "Users", exact: true }),
    ).toHaveCount(0);
    expect(
      (await page.evaluate(() => window.pos.call("status"))).data.ownerOnly,
    ).toBe(true);
    const blocked = await page.evaluate(() =>
      window.pos.call("users", {
        username: "forbidden",
        password: "never created password",
        role: "Owner",
      }),
    );
    expect(blocked.error).toBe("FORBIDDEN");
    await page
      .locator("nav")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    const section = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Owner security settings",
        exact: true,
      }),
    });
    await section.locator("input[name=current]").fill(password);
    await section
      .getByRole("button", {
        name: "Create / replace recovery key",
        exact: true,
      })
      .click();
    const secret = page.locator(".recovery-secret code");
    await expect(secret).toBeVisible();
    const key = await secret.textContent();
    expect(/^(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/.test(key)).toBe(true);
    await page
      .getByRole("button", { name: "I saved it · hide key", exact: true })
      .click();
    await expect(secret).toHaveCount(0);
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await page
      .getByRole("button", { name: "Forgot password?", exact: true })
      .click();
    await page.getByLabel("Username", { exact: true }).fill(username);
    const next = "synthetic replacement password";
    await page
      .getByLabel("New password (10+ characters)", { exact: true })
      .fill(next);
    await page.getByLabel("Recovery key", { exact: true }).fill(key);
    await page
      .getByRole("button", { name: "Reset with recovery key", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Log in", exact: true }).first(),
    ).toBeVisible();
    expect(
      (await page.evaluate(() => window.pos.call("status"))).data.user,
    ).toBeNull();
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page
      .getByLabel("Password (10+ characters)", { exact: true })
      .fill(next);
    await page
      .getByRole("button", { name: "Log in", exact: true })
      .first()
      .click();
    await expect(page.locator("nav")).toBeVisible();
    const changed = await page.evaluate(
      ({ current, password }) =>
        window.pos.call("password", { current, password }),
      { current: next, password },
    );
    expect(changed.ok).toBe(true);
    const consumed = await page.evaluate(
      ({ username, key }) =>
        window.pos.call("recoveryReset", {
          username,
          key,
          password: "must never become password",
        }),
      { username, key },
    );
    expect(consumed.error).toBe("LOGIN_FAILED");
    await new Promise((r) => setTimeout(r, 1100));
    await page.locator("nav button").first().click();
    console.log(
      "PASS: Free Owner UI, blocked staff creation, password-authorized key generation, hide key, logged-out recovery, login with replacement password and consumed-key rejection.",
    );
  } catch (error) {
    throw new Error(
      String(error).replace(
        /(?:[A-F0-9]{8}-){7}[A-F0-9]{8}/gi,
        "[REDACTED RECOVERY KEY]",
      ),
    );
  } finally {
    await page
      .evaluate(() => {
        document
          .querySelectorAll(".recovery-secret")
          .forEach((e) => e.remove());
        document
          .querySelectorAll("input[name=recoveryKey]")
          .forEach((e) => (e.value = ""));
      })
      .catch(() => {});
  }
}
