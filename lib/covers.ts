/** Live campaign docs still point at the old SVG paths. Paintings share the same name. */
const PAINTINGS: Record<string, string> = {
  "/covers/abbey.svg": "/covers/abbey.jpg",
  "/covers/frost.svg": "/covers/frost.jpg",
  "/covers/storm.svg": "/covers/storm.jpg",
  "/covers/wilds.svg": "/covers/wilds.jpg",
  "/covers/tavern.svg": "/covers/tavern.jpg",
  "/covers/arcane.svg": "/covers/arcane.jpg",
};

export function coverArt(src: string | undefined): string {
  if (!src) return "/covers/tavern.jpg";
  return PAINTINGS[src] || src.replace(/\.svg$/, ".jpg");
}
