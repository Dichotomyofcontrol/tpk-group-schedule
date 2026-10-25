export type ThemeChoice = "light" | "dark" | "system";

/** Almanac ink is the default. Paper (light) is an explicit stored choice. "system" follows neither the OS nor the old cream default. */
export function readStoredTheme(): ThemeChoice {
  try {
    if (!window.localStorage.getItem("tpk-theme-v3")) {
      window.localStorage.setItem("tpk-theme", "dark");
      window.localStorage.setItem("tpk-theme-v3", "1");
      return "dark";
    }
    const saved = window.localStorage.getItem("tpk-theme");
    if (saved === "light") return "light";
    if (saved === "system") window.localStorage.setItem("tpk-theme", "dark");
    return "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemeChoice): "light" | "dark" {
  const night = theme !== "light";
  document.documentElement.dataset.theme = night ? "night" : "cream";
  const color = night ? "#0b0a0c" : "#efe7da";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  return night ? "dark" : "light";
}
