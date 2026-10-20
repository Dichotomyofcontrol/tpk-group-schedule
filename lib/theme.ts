/** Daylight is the default. Night is only on when someone chose it. */
export type ThemeChoice = "light" | "dark";

export function readThemeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem("tpk-theme");
    if (saved === "system") window.localStorage.setItem("tpk-theme", "light");
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function writeThemeChoice(theme: ThemeChoice) {
  try {
    window.localStorage.setItem("tpk-theme", theme);
  } catch { /* private mode */ }
}

export function applyThemeChoice(theme: ThemeChoice) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#1a1410" : "#efe2c4");
}
