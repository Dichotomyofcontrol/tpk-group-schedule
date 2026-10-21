/** Earthy display hues for the schedule. Stored campaign.color stays untouched. */

const HUES: readonly (readonly [string, string])[] = [
  ["#B4542C", "#E39A78"],
  ["#3D6F74", "#8FCFD4"],
  ["#5E7040", "#B7C98A"],
  ["#8A5A32", "#E0B07A"],
  ["#6B4C62", "#D7A8C4"],
  ["#9A7430", "#E6C57A"],
  ["#7A4038", "#E0A098"],
  ["#3E564C", "#A4C4B4"],
];

export function campaignColors(id: string): { day: string; night: string } {
  let n = 2166136261;
  for (const ch of id) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  const [day, night] = HUES[(n >>> 0) % HUES.length];
  return { day, night };
}
