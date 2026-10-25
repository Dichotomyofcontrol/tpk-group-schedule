/** In-memory roster for demo mode, when Firebase Admin is not configured. */
import { buildRosterPlayer, markLinkShared, parseRosterInput, patchRosterPlayer, rosterNameTaken, type RosterPlayer } from "./roster";

const SALT_CREATED = "2026-10-01T00:00:00.000Z";

export const SALTMARSH_ROSTER: RosterPlayer[] = [
  {
    id: "rp-seth",
    cid: "saltmarsh",
    name: "Seth",
    status: "joined",
    token: "salt-seth-seat-demo",
    memberId: "seth",
    createdAt: SALT_CREATED,
    updatedAt: SALT_CREATED,
  },
  {
    id: "rp-elara",
    cid: "saltmarsh",
    name: "Elara",
    characterName: "Elara Voss",
    status: "invited",
    token: "salt-elara-seat-demo",
    createdAt: SALT_CREATED,
    updatedAt: SALT_CREATED,
  },
  {
    id: "rp-corin",
    cid: "saltmarsh",
    name: "Corin",
    characterName: "Corin Hale",
    email: "corin@example.com",
    phone: "(415) 555-0136",
    status: "invited",
    token: "salt-corin-seat-demo",
    createdAt: SALT_CREATED,
    updatedAt: SALT_CREATED,
  },
];

type RosterGlobals = {
  __tpkRoster?: Map<string, RosterPlayer[]>;
  __tpkRosterTokens?: Map<string, { cid: string; id: string }>;
};

function globals(): Required<Pick<RosterGlobals, "__tpkRoster" | "__tpkRosterTokens">> {
  const bag = globalThis as typeof globalThis & RosterGlobals;
  if (!bag.__tpkRoster || !bag.__tpkRosterTokens) {
    bag.__tpkRoster = new Map();
    bag.__tpkRosterTokens = new Map();
    for (const player of SALTMARSH_ROSTER) {
      const list = bag.__tpkRoster.get(player.cid) || [];
      list.push({ ...player });
      bag.__tpkRoster.set(player.cid, list);
      bag.__tpkRosterTokens.set(player.token, { cid: player.cid, id: player.id });
    }
  }
  return { __tpkRoster: bag.__tpkRoster, __tpkRosterTokens: bag.__tpkRosterTokens };
}

export function resetDemoRoster(): void {
  const bag = globalThis as typeof globalThis & RosterGlobals;
  delete bag.__tpkRoster;
  delete bag.__tpkRosterTokens;
  globals();
}

export function listDemoRoster(cid: string): RosterPlayer[] {
  return (globals().__tpkRoster.get(cid) || []).map((player) => ({ ...player }));
}

export function demoRosterByToken(token: string): RosterPlayer | null {
  const hit = globals().__tpkRosterTokens.get(token);
  if (!hit) return null;
  return listDemoRoster(hit.cid).find((player) => player.id === hit.id) || null;
}

export function saveDemoRosterPlayer(player: RosterPlayer): void {
  const maps = globals();
  const list = maps.__tpkRoster.get(player.cid) || [];
  const index = list.findIndex((item) => item.id === player.id);
  if (index >= 0) list[index] = { ...player };
  else list.push({ ...player });
  maps.__tpkRoster.set(player.cid, list);
  maps.__tpkRosterTokens.set(player.token, { cid: player.cid, id: player.id });
}

export function removeDemoRosterPlayer(cid: string, id: string): boolean {
  const maps = globals();
  const list = maps.__tpkRoster.get(cid) || [];
  const player = list.find((item) => item.id === id);
  if (!player) return false;
  maps.__tpkRoster.set(cid, list.filter((item) => item.id !== id));
  maps.__tpkRosterTokens.delete(player.token);
  return true;
}

export function addDemoRosterPlayer(cid: string, body: unknown, id: string, token: string, now = new Date()): RosterPlayer | { error: string } {
  const parsed = parseRosterInput(body);
  if (!parsed.ok) return { error: parsed.error };
  const list = listDemoRoster(cid);
  if (list.length >= 40) return { error: "This roster is full." };
  if (rosterNameTaken(list, parsed.value.name)) return { error: "That name is already on the roster." };
  const player = buildRosterPlayer(cid, parsed.value, id, token, now);
  saveDemoRosterPlayer(player);
  return player;
}

export function markDemoRosterShared(cid: string, id: string, now = new Date()): RosterPlayer | { error: string } {
  const current = listDemoRoster(cid).find((player) => player.id === id);
  if (!current) return { error: "That player isn't on the roster." };
  const player = markLinkShared(current, now);
  saveDemoRosterPlayer(player);
  return player;
}

export function editDemoRosterPlayer(cid: string, id: string, body: unknown, now = new Date()): RosterPlayer | { error: string } {
  const parsed = parseRosterInput(body);
  if (!parsed.ok) return { error: parsed.error };
  const list = listDemoRoster(cid);
  const current = list.find((player) => player.id === id);
  if (!current) return { error: "That player isn't on the roster." };
  if (rosterNameTaken(list, parsed.value.name, id)) return { error: "That name is already on the roster." };
  const player = patchRosterPlayer(current, parsed.value, now);
  saveDemoRosterPlayer(player);
  return player;
}
