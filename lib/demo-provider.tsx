"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDemo } from "./demo-data";
import { nestedRecapPath, validatePdf } from "./recap";
import {
  acceptInvite,
  addPoll,
  applyCadence,
  createCampaign,
  createInvite,
  editSession,
  lockPoll,
  saveRecap,
  markAttendance,
  moveSession,
  nudgePoll,
  removeMember,
  restoreSession,
  cancelSession,
  setCampaignPatch,
  setMember,
  skipSession,
  toggleVote,
  transferOrganizer,
} from "./model";
import { StoreContext, type CampaignInput, type StoreApi } from "./store";
import { magicLinkContinueUrl } from "./magic-link";
import { applyThemeChoice, readThemeChoice, writeThemeChoice, type ThemeChoice } from "./theme";
import type { AppState, AttendanceState, Cadence, Campaign, Invite, Member, Poll, Session, Toast, User } from "./types";

const GUEST: User = {
  id: "",
  email: "",
  displayName: "",
  tz: "America/Los_Angeles",
  calToken: "",
  canCreateCampaigns: false,
};

const STORAGE = "tpk-playdates-v1";

function isState(value: unknown): value is AppState {
  return !!value && typeof value === "object" && Array.isArray((value as AppState).campaigns) && !!(value as AppState).me;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => buildDemo("giada"));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<ThemeChoice>(() => (typeof window === "undefined" ? "light" : readThemeChoice()));
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light");
  const [online, setOnline] = useState(true);
  const toastId = useRef(1);
  const stateRef = useRef(state);
  const pdfBlobs = useRef(new Map<string, string>());
  const [pdfRev, setPdfRev] = useState(0);
  stateRef.current = state;

  const flash = useCallback((text: string, tone?: Toast["tone"]) => {
    const id = toastId.current++;
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  const commit = useCallback((result: AppState | { error: string }) => {
    if ("error" in result) {
      flash(result.error, "err");
      return null;
    }
    setState(result);
    return result;
  }, [flash]);

  useEffect(() => {
    setThemeState(readThemeChoice());
    const params = new URLSearchParams(window.location.search);
    if (params.get("demoLink") === "1") return;
    if (!params.get("as")) {
      try {
        const raw = window.localStorage.getItem(STORAGE);
        if (raw && isState(JSON.parse(raw))) setState(JSON.parse(raw) as AppState);
      } catch { /* keep the seed */ }
    }
    document.body.dataset.ready = "1";
  }, []);

  useEffect(() => {
    if (document.body.dataset.ready !== "1") return;
    window.localStorage.setItem(STORAGE, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    applyThemeChoice(theme);
    setResolved(theme);
  }, [theme]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const setTheme = useCallback((next: "light" | "dark" | "system") => {
    const choice: ThemeChoice = next === "dark" ? "dark" : "light";
    setThemeState(choice);
    writeThemeChoice(choice);
  }, []);

  const api = useMemo<StoreApi>(() => {
    const apply = (fn: (current: AppState) => AppState | { error: string }) => {
      commit(fn(stateRef.current));
    };
    return {
      state,
      mode: "demo",
      online,
      toasts,
      theme,
      resolvedTheme,
      setTheme,
      dismissToast: (id) => setToasts((list) => list.filter((t) => t.id !== id)),
      flash,
      setPersona: (id) => {
        if (id === "guest") {
          if (stateRef.current.me.id) {
            setState({ ...stateRef.current, me: { ...GUEST, tz: stateRef.current.me.tz || GUEST.tz } });
          }
          document.body.dataset.persona = "guest";
          return;
        }
        const person = stateRef.current.directory.find((u) => u.id === id);
        if (!person || person.id === stateRef.current.me.id) {
          document.body.dataset.persona = stateRef.current.me.id || "guest";
          return;
        }
        setState({ ...stateRef.current, me: person });
        document.body.dataset.persona = id;
      },
      resetDemo: () => {
        const id = stateRef.current.me.id;
        window.localStorage.removeItem(STORAGE);
        setState(buildDemo(id));
        flash("Sample table reset.");
      },
      toggleHidden: (cid) => {
        const hidden = new Set(stateRef.current.hiddenCids);
        if (hidden.has(cid)) hidden.delete(cid);
        else hidden.add(cid);
        setState({ ...stateRef.current, hiddenCids: [...hidden] });
      },
      mark: (sessionId, uid, attendance: AttendanceState, note?) => {
        apply((s) => markAttendance(s, sessionId, uid, attendance, note));
      },
      skip: (sessionId) => apply((s) => skipSession(s, sessionId)),
      cancel: (sessionId) => apply((s) => cancelSession(s, sessionId)),
      restore: (sessionId) => apply((s) => restoreSession(s, sessionId)),
      move: (sessionId, ymd, hm, location) => apply((s) => moveSession(s, sessionId, ymd, hm, location)),
      editSession: (sessionId, patch) => apply((s) => editSession(s, sessionId, patch)),
      saveRecap: (sessionId, patch) => apply((s) => saveRecap(s, sessionId, patch)),
      attachPdf: async (sessionId, file) => {
        const problem = validatePdf(file);
        if (problem) {
          flash(problem, "err");
          return;
        }
        const session = stateRef.current.sessions.find((item) => item.id === sessionId);
        if (!session) return;
        const previous = pdfBlobs.current.get(sessionId);
        if (previous) URL.revokeObjectURL(previous);
        pdfBlobs.current.set(sessionId, URL.createObjectURL(file));
        setPdfRev((value) => value + 1);
        apply((s) => saveRecap(s, sessionId, {
          pdfPath: nestedRecapPath(session.cid, session.id, file.name),
          pdfName: file.name,
          pdfUrl: null,
        }));
        flash("PDF attached for this preview. On the live site it stays in Storage for the campaign.");
      },
      clearPdf: (sessionId) => {
        const previous = pdfBlobs.current.get(sessionId);
        if (previous) URL.revokeObjectURL(previous);
        pdfBlobs.current.delete(sessionId);
        setPdfRev((value) => value + 1);
        apply((s) => saveRecap(s, sessionId, { pdfPath: null }));
      },
      pdfPreviewUrl: (sessionId) => pdfBlobs.current.get(sessionId) ?? null,
      saveCadence: (cid, cadence: Cadence | null) => apply((s) => applyCadence(s, cid, cadence)),
      patchCampaign: (cid, patch: Partial<Campaign>) => apply((s) => setCampaignPatch(s, cid, patch)),
      patchMember: (cid, memberId, patch: Partial<Member>) => apply((s) => setMember(s, cid, memberId, patch)),
      transfer: (cid, uid) => apply((s) => transferOrganizer(s, cid, uid)),
      removeMember: (cid, memberId) => apply((s) => removeMember(s, cid, memberId)),
      createCampaign: (input: CampaignInput) => {
        const result = createCampaign(stateRef.current, input);
        if ("error" in result) {
          flash(result.error, "err");
          return null;
        }
        setState(result);
        const created = result.campaigns[result.campaigns.length - 1];
        return created?.id ?? null;
      },
      toggleVote: (pollId, optionId) => apply((s) => toggleVote(s, pollId, optionId)),
      lockPoll: (pollId, optionId) => {
        const result = lockPoll(stateRef.current, pollId, optionId);
        if ("error" in result) flash(result.error, "err");
        else {
          setState(result);
          flash("Locked in. It's a real play date now.");
        }
      },
      addPoll: (cid, title, options: Poll["options"]) => {
        const result = addPoll(stateRef.current, cid, title, options);
        if ("error" in result) flash(result.error, "err");
        else setState(result);
      },
      nudge: (pollId, uid) => {
        apply((s) => nudgePoll(s, pollId, uid));
        flash("Nudge saved. It emails them once reminders are connected.");
      },
      createInvite: (cid, role: Invite["role"], email?) => {
        const result = createInvite(stateRef.current, cid, role, email);
        if ("error" in result) {
          flash(result.error, "err");
          return null;
        }
        setState(result);
        const invite = result.invites[result.invites.length - 1];
        flash(email ? `Invite ready for ${email}.` : "Link copied to your invites.");
        return invite?.token ?? null;
      },
      acceptInvite: (token, person) => {
        const me = person ?? {
          id: stateRef.current.me.id,
          email: stateRef.current.me.email,
          displayName: stateRef.current.me.displayName,
        };
        const result = acceptInvite(stateRef.current, token, me);
        if ("error" in result) {
          flash(result.error, "err");
          return false;
        }
        setState(result);
        return true;
      },
      sendMagicLink: async (email, inviteToken) => {
        const trimmed = email.trim();
        window.sessionStorage.setItem("tpk-magic-email", trimmed);
        const url = new URL(magicLinkContinueUrl(window.location.origin, inviteToken));
        url.searchParams.set("demoLink", "1");
        window.location.assign(url.toString());
      },
      finishMagicLink: async (email) => {
        const params = new URLSearchParams(window.location.search);
        const pending = window.sessionStorage.getItem("tpk-magic-email");
        if (params.get("demoLink") !== "1" && !email && !pending) return "not-link";
        const stored = (email || pending || "").trim();
        if (!stored) return "need-email";
        const person = stateRef.current.directory.find((user) => user.email.toLowerCase() === stored.toLowerCase());
        const me: User = person ?? {
          id: `mail-${stored.toLowerCase()}`,
          email: stored,
          displayName: stored.split("@")[0] || "Player",
          tz: stateRef.current.me.tz || "America/Los_Angeles",
          calToken: "demo",
          canCreateCampaigns: false,
        };
        setState({ ...stateRef.current, me });
        window.sessionStorage.removeItem("tpk-magic-email");
        document.body.dataset.persona = me.id;
        return "ok";
      },
      signOut: async () => {
        setState({ ...stateRef.current, me: { ...GUEST, tz: stateRef.current.me.tz || GUEST.tz } });
        document.body.dataset.persona = "guest";
      },
      signedIn: Boolean(state.me.id),
    };
  }, [state, online, toasts, theme, resolvedTheme, setTheme, flash, commit, pdfRev]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
