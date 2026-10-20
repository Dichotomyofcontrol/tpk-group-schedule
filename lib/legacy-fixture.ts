import type { LegacyExport } from "./migrate";

/** Representative export shaped like the live Firestore documents in index.html. */
const seed: [string, string, string, string?][] = [
  ["2026-04-01", "6:00 PM", "frostmaiden"],
  ["2026-04-22", "6:00 PM", "frostmaiden"],
  ["2026-04-24", "6:00 PM", "strahd"],
  ["2026-04-29", "6:00 PM", "frostmaiden"],
  ["2026-05-13", "6:00 PM", "frostmaiden"],
  ["2026-05-27", "6:00 PM", "frostmaiden"],
  ["2026-06-10", "6:00 PM", "frostmaiden"],
  ["2026-06-20", "5:00 PM", "special"],
  ["2026-06-24", "6:00 PM", "frostmaiden"],
  ["2026-06-26", "6:00 PM", "strahd"],
  ["2026-07-08", "6:00 PM", "drawsteel"],
  ["2026-07-16", "6:00 PM", "leyfarers"],
  ["2026-07-22", "6:00 PM", "drawsteel"],
  ["2026-07-24", "6:00 PM", "strahd"],
  ["2026-07-30", "6:00 PM", "leyfarers"],
  ["2026-08-05", "6:00 PM", "drawsteel"],
  ["2026-08-13", "6:00 PM", "leyfarers"],
  ["2026-08-19", "6:00 PM", "drawsteel"],
  ["2026-08-21", "6:00 PM", "strahd"],
  ["2026-08-24", "6:30 PM", "beerovia", "The Tithe"],
  ["2026-08-27", "6:00 PM", "leyfarers"],
  ["2026-09-02", "6:00 PM", "frostmaiden"],
  ["2026-09-09", "6:00 PM", "frostmaiden"],
  ["2026-09-11", "6:00 PM", "beerovia", "Blood o' the Vine"],
  ["2026-09-16", "6:00 PM", "frostmaiden"],
  ["2026-09-23", "6:00 PM", "frostmaiden"],
  ["2026-09-25", "6:00 PM", "strahd", "Argynvostholt"],
  ["2026-09-30", "6:00 PM", "frostmaiden"],
  ["2026-10-07", "6:00 PM", "frostmaiden"],
  ["2026-10-09", "6:30 PM", "strahd", "The Wizard of Wines"],
  ["2026-10-14", "6:00 PM", "frostmaiden"],
  ["2026-10-21", "6:00 PM", "frostmaiden"],
  ["2026-10-23", "6:00 PM", "strahd"],
  ["2026-10-28", "6:00 PM", "frostmaiden"],
  ["2026-11-04", "6:00 PM", "frostmaiden"],
  ["2026-11-11", "6:00 PM", "frostmaiden"],
  ["2026-11-18", "6:00 PM", "frostmaiden"],
  ["2026-11-25", "6:00 PM", "frostmaiden"],
  ["2026-11-27", "6:00 PM", "strahd"],
  ["2026-12-02", "6:00 PM", "frostmaiden"],
  ["2026-12-09", "6:00 PM", "frostmaiden"],
  ["2026-12-11", "6:00 PM", "strahd"],
  ["2026-12-16", "6:00 PM", "frostmaiden"],
  ["2026-12-23", "6:00 PM", "frostmaiden"],
  ["2026-12-30", "6:00 PM", "frostmaiden"],
];

export function sampleLegacyExport(): LegacyExport {
  return {
    source: "fixture shaped like campaigns/sessions/shares/access/gameRoles in the current index.html",
    campaigns: [
      { id: "strahd", name: "Curse of Strahd", icon: "🧛", color: "#ef5350", owner: "sthomas131@gmail.com", access: { "amy@example.com": "editor", "sam@example.com": "viewer" }, gameRoles: { "sthomas131@gmail.com": "gm", "ben@example.com": "gm" } },
      { id: "frostmaiden", name: "Rime of the Frostmaiden", icon: "❄️", color: "#4fc3f7", owner: "sthomas131@gmail.com", access: { "lizbeth@example.com": "viewer" }, gameRoles: { "sthomas131@gmail.com": "gm" } },
      { id: "drawsteel", name: "Draw Steel: Mini Campaign", icon: "🗡️", color: "#f5c518", owner: "sthomas131@gmail.com", access: {} },
      { id: "leyfarers", name: "Leyfarers", icon: "🧭", color: "#4caf50", owner: "sthomas131@gmail.com", access: { "amy@example.com": "editor" } },
      { id: "beerovia", name: "Beerovia", icon: "🍺", color: "#ff9800", owner: "sthomas131@gmail.com", access: {} },
      { id: "special", name: "One-Shots", icon: "✨", color: "#ce93d8", owner: "sthomas131@gmail.com", access: {} },
    ],
    shares: [
      { owner: "sthomas131@gmail.com", campaign: "strahd", members: ["amy@example.com", "sam@example.com", "kai@example.com", "giada@example.com", "ben@example.com"] },
      { owner: "sthomas131@gmail.com", campaign: "frostmaiden", members: ["lizbeth@example.com", "giada@example.com"] },
      { owner: "sthomas131@gmail.com", campaign: "beerovia", members: ["ben@example.com"] },
    ],
    sessions: seed.map(([date, time, campaign, title], index) => ({
      id: title ? `${date}-${campaign}` : date + (index % 7 === 0 ? `-${campaign}` : ""),
      date,
      time,
      campaign,
      gm: campaign === "leyfarers" ? "Sage" : "Max Hobbs",
      duration: "4 hrs",
      status: "active",
      title,
      location: "TPK Brewing",
      readers: ["sthomas131@gmail.com"],
      ...(date === "2026-10-09" && campaign === "strahd"
        ? {
            recap: "The vineyard burned.",
            recapHtml: "<p>The vineyard burned, Ichabod kept the gem.</p>",
            pdfUrl: "/recaps/2026-10-09_Wizard_of_Wines.pdf",
            pdfName: "Wizard of Wines.pdf",
          }
        : {}),
      attendance: (campaign === "strahd" && date === "2026-10-23"
        ? { Lysander: "out", Giada: "in" }
        : { Giada: "in" }) as Record<string, string>,
    })),
    polls: [{ id: "old-frost", campaign: "frostmaiden", title: "December", status: "open" }],
  };
}
