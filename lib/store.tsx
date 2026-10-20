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
};

export type StoreApi = {
  state: AppState;
  mode: "demo" | "live";
  online: boolean;
  toasts: Toast[];
  /** Night is opt-in. "system" is treated as daylight. */
  theme: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
  dismissToast: (id: number) => void;
  flash: (text: string, tone?: Toast["tone"]) => void;
  setPersona: (id: string) => void;
  resetDemo: () => void;
  toggleHidden: (cid: string) => void;
  mark: (sessionId: string, uid: string, attendance: AttendanceState, note?: string) => void;
  skip: (sessionId: string) => void;
  cancel: (sessionId: string) => void;
  restore: (sessionId: string) => void;
  move: (sessionId: string, ymd: string, hm: string, location?: string) => void;
  editSession: (sessionId: string, patch: Partial<Pick<Session, "title" | "location" | "notes" | "requireRsvps" | "snackUid">>) => void;
  saveRecap: (sessionId: string, patch: RecapPatch) => void;
  attachPdf: (sessionId: string, file: File) => Promise<void>;
  clearPdf: (sessionId: string) => void;
  /** In-memory preview for a PDF attached during this browser tab. Not persisted. */
  pdfPreviewUrl: (sessionId: string) => string | null;
  saveCadence: (cid: string, cadence: Cadence | null) => void;
  patchCampaign: (cid: string, patch: Partial<Campaign>) => void;
  patchMember: (cid: string, memberId: string, patch: Partial<Member>) => void;
  transfer: (cid: string, uid: string) => void;
  removeMember: (cid: string, memberId: string) => void;
  createCampaign: (input: CampaignInput) => string | null;
  toggleVote: (pollId: string, optionId: string) => void;
  lockPoll: (pollId: string, optionId: string) => void;
  addPoll: (cid: string, title: string, options: Poll["options"]) => void;
  nudge: (pollId: string, uid: string) => void;
  createInvite: (cid: string, role: Invite["role"], email?: string) => string | null;
  acceptInvite: (token: string, person?: { id: string; email: string; displayName: string; characterName?: string }) => boolean;
  sendMagicLink: (email: string, inviteToken?: string) => Promise<void>;
  /** Completes an email-link landing on /auth/finish. */
  finishMagicLink: (email?: string) => Promise<"ok" | "need-email" | "not-link">;
  signOut: () => Promise<void>;
  signedIn: boolean;
};

export const StoreContext = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}
