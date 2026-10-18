import "./theme.css";
export type Theme = "light" | "dark";
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("pos.theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Storage may be unavailable; the toggle still works for this session. */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = theme === "dark" ? "#101823" : "#f3f5f8";
}
applyTheme(readTheme());
