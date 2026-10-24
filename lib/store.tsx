"use client";

import { createContext, useContext } from "react";
import type { RecapPatch } from "./recap";
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
  addPoll: (cid: string, title: string, options: Poll["options"]) => void;
  /** A standalone one-shot: its own little table (no campaign) plus the date poll. Returns its id. */
  createOneShot: (input: OneShotInput) => string | null;
  nudge: (pollId: string, uid: string) => void;
  createInvite: (cid: string, role: Invite["role"], email?: string) => Promise<string | null>;
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
