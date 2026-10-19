import { ipcRenderer } from "electron";
window.addEventListener("DOMContentLoaded", () => {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-receipt-action]"),
  );
  for (const button of buttons)
    button.addEventListener("click", async () => {
      buttons.forEach((b) => (b.disabled = true));
      const status = document.querySelector<HTMLElement>("[role=status]");
      if (status) status.textContent = "";
      try {
        const result = await ipcRenderer.invoke(
          "receipt:action",
          button.dataset.receiptAction,
        );
        if (status) status.textContent = result.message || "";
      } catch {
        if (status) status.textContent = "ERROR";
      } finally {
        buttons.forEach((b) => (b.disabled = false));
      }
    });
});
