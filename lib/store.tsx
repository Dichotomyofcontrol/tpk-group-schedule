"use client";

import { createContext, useContext } from "react";
import type { GuestBallot } from "./poll-public";
import type { RecapPatch } from "./recap";
import type { RosterInput, RosterPlayer } from "./roster";
import type { AppState, AttendanceState, Cadence, Campaign, Invite, Member, Poll, Session, Toast } from "./types";

export type CampaignInput = {
  name: string;
  color: string;
  icon: string;
  tz: string;
  location: string;
  requireRsvps: boolean;
  allowMemberInvites: boolean;
  cadence: Cadence | null;
  kind?: "oneshot";
};

export type OneShotInput = { title: string; tz: string; location: string; options: Poll["options"] };

export type StoreApi = {
  state: AppState;
  mode: "demo" | "live";
  online: boolean;
  toasts: Toast[];
  theme: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
  dismissToast: (id: number) => void;
  flash: (text: string, tone?: Toast["tone"], action?: Toast["action"]) => void;
  setPersona: (id: string) => void;
  resetDemo: () => void;
  toggleHidden: (cid: string) => void;
  mark: (sessionId: string, uid: string, attendance: AttendanceState, note?: string) => void;
  skip: (sessionId: string) => void;
  cancel: (sessionId: string) => void;
  restore: (sessionId: string) => void;
  move: (sessionId: string, ymd: string, hm: string, location?: string) => void;
  editSession: (sessionId: string, patch: Partial<Pick<Session, "title" | "location" | "notes" | "requireRsvps">>) => void;
  saveRecap: (sessionId: string, patch: RecapPatch) => void;
  /** Uploads a PDF and adds it to the night. Resolves to an error message, or null on success. */
  attachPdf: (sessionId: string, file: File, onProgress?: (fraction: number) => void) => Promise<string | null>;
  replacePdf: (sessionId: string, oldPath: string, file: File, onProgress?: (fraction: number) => void) => Promise<string | null>;
  removePdf: (sessionId: string, path: string) => Promise<void>;
  /** A short-lived URL for one recap file (a signed URL on the live site). */
  fileUrl: (sessionId: string, path: string, download?: boolean) => Promise<string | null>;
  /** Object URL for a campaign cover in Storage. */
  coverUrl: (path: string) => Promise<string | null>;
  uploadCover: (cid: string, image: Blob) => Promise<boolean>;
  removeCover: (cid: string) => void;
  archiveCampaign: (cid: string, archived: boolean) => void;
  deleteCampaign: (cid: string) => Promise<boolean>;
  leaveCampaign: (cid: string) => Promise<boolean>;
  /** Your own row at one table: character name and reminder emails. */
  patchMe: (cid: string, patch: { characterName?: string; remindersOff?: boolean }) => void;
  setDisplayName: (name: string) => Promise<void>;
  saveCadence: (cid: string, cadence: Cadence | null) => void;
  patchCampaign: (cid: string, patch: Partial<Campaign>) => void;
  patchMember: (cid: string, memberId: string, patch: Partial<Member>) => void;
  transfer: (cid: string, uid: string) => void;
  removeMember: (cid: string, memberId: string) => void;
  createCampaign: (input: CampaignInput) => string | null;
  toggleVote: (pollId: string, optionId: string) => void;
  lockPoll: (pollId: string, optionId: string) => void;
  addPoll: (cid: string, title: string, options: Poll["options"]) => string | null;
  /** Drop a newer copy of a poll into local state (demo fallback for a public vote). */
  replacePoll: (poll: Poll) => void;
  /** Add public-link ballots the member card doesn't have yet. */
  mergeGuestBallots: (pollId: string, ballots: GuestBallot[]) => void;
  /** A standalone one-shot: its own little table (no campaign) plus the date poll. Returns its id. */
  createOneShot: (input: OneShotInput) => string | null;
  nudge: (pollId: string, uid: string) => void;
  createInvite: (cid: string, role: Invite["role"], email?: string) => Promise<string | null>;
  rosterList: (cid: string) => Promise<RosterPlayer[]>;
  rosterAdd: (cid: string, input: RosterInput) => Promise<RosterPlayer | { error: string }>;
  rosterSave: (cid: string, id: string, input: RosterInput) => Promise<RosterPlayer | { error: string }>;
  rosterRemove: (cid: string, id: string) => Promise<boolean>;
  claimSeat: (token: string) => Promise<{
    ok: true;
    campaignName: string;
    cid: string;
    player: { id: string; name: string; characterName?: string; status: RosterPlayer["status"]; memberId?: string };
    member: Member | null;
    created: boolean;
    linked: boolean;
    already: boolean;
  } | { ok: false; error: string }>;
  acceptInvite: (token: string, person?: { id: string; email: string; displayName: string; characterName?: string }) => boolean;
  sendMagicLink: (email: string, inviteToken?: string) => Promise<void>;
  /** Completes an email-link landing on /auth/finish. */
  finishMagicLink: (email?: string) => Promise<"ok" | "need-email" | "not-link">;
  signOut: () => Promise<void>;
  signedIn: boolean;
  /** True once Firebase has answered and nobody is signed in (live mode only). */
  signedOutConfirmed?: boolean;
};

export const StoreContext = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}
