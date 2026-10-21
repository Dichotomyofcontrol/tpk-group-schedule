export type ThemeChoice = "light" | "dark" | "system";

/** Cream is the default. Night is only an explicit stored choice. "system" is rewritten to light. */
export function readStoredTheme(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem("tpk-theme");
    if (saved === "dark" || saved === "night") return "dark";
    if (saved === "system") window.localStorage.setItem("tpk-theme", "light");
    return "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: ThemeChoice): "light" | "dark" {
  const night = theme === "dark";
  document.documentElement.dataset.theme = night ? "night" : "cream";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#0F1218" : "#F3EDE1");
  return night ? "dark" : "light";
}
