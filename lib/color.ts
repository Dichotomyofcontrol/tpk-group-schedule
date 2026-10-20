export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = "888888";
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** White ink when it clears WCAG AA on the tile, otherwise near-black. */
export function textOn(hex: string): string {
  const dark = "#1c1f24";
  const light = "#ffffff";
  return contrastRatio(hex, light) >= 4.5 ? light : dark;
}

/** Campaign colour darkened when it would fail as text on a light surface. */
export function accentInk(hex: string): string {
  if (luminance(hex) <= 0.28) return hex;
  const { r, g, b } = hexToRgb(hex);
  const f = 0.52;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

export function contrastRatio(a: string, b: string): number {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
