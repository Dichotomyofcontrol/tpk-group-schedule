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

const SCENES = ["/brand/cover-emberfall.svg", "/brand/cover-drowned-crown.svg", "/brand/cover-wildwood.svg"];

/** Sample plates use the approved night landscapes. An uploaded image keeps its own file. */
export function coverSrc(src: string, id = ""): string {
  if (src.startsWith("/covers/") && src.endsWith(".svg")) {
    let n = 0;
    for (const ch of id) n += ch.charCodeAt(0);
    return SCENES[n % SCENES.length];
  }
  return src;
}
