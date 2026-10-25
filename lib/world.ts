/** Editorial worlds from the TPK Almanac. Known tables keep their theme; anything else keeps a visible accent. */

export type WorldId = "ice" | "blood" | "salt" | "ember" | "ley" | "vine" | "table";

export type World = {
  id: WorldId;
  /** Giant watermark word. */
  word: string;
  accent: string;
  place: string;
};

const WORLDS: Record<Exclude<WorldId, "table">, World> = {
  ice: { id: "ice", word: "Ice", accent: "#7fd3ff", place: "Icewind Dale" },
  blood: { id: "blood", word: "Blood", accent: "#ff3b4e", place: "Barovia" },
  salt: { id: "salt", word: "Salt", accent: "#3ff0c4", place: "The Azure Sea" },
  ember: { id: "ember", word: "Ember", accent: "#ffb15a", place: "The Forge" },
  ley: { id: "ley", word: "Ley", accent: "#d2b4ff", place: "The Leylines" },
  vine: { id: "vine", word: "Vine", accent: "#e4c15a", place: "The Vineyard" },
};

const FALLBACK = ["#ffb15a", "#d2b4ff", "#e4c15a", "#7fd3ff", "#3ff0c4", "#ff8f6b"];

export function worldFor(campaign: { id: string; name: string; slug?: string; color?: string }): World {
  const key = `${campaign.id} ${campaign.slug ?? ""} ${campaign.name}`.toLowerCase();
  if (/frost|rime|icewind/.test(key)) return WORLDS.ice;
  if (/strahd|barovia/.test(key)) return WORLDS.blood;
  if (/saltmarsh|ghosts of salt|azure sea|\bsalt\b/.test(key)) return WORLDS.salt;
  if (/draw.?steel|\bember\b/.test(key)) return WORLDS.ember;
  if (/leyfarer|\bley\b/.test(key)) return WORLDS.ley;
  if (/beerovia|\bbeer\b/.test(key)) return WORLDS.vine;
  let n = 0;
  for (const ch of campaign.id) n = (n + ch.charCodeAt(0)) % FALLBACK.length;
  const word = campaign.name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).find((w) => w.length > 2) || "Table";
  return {
    id: "table",
    word: word.slice(0, 12),
    accent: campaign.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(campaign.color) ? campaign.color : FALLBACK[n],
    place: "The Table",
  };
}

export function accentVar(campaign: { id: string; name: string; slug?: string; color?: string }): { "--acc": string } {
  return { "--acc": worldFor(campaign).accent };
}
