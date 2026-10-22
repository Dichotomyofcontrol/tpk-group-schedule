"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDemo } from "./demo-data";
import { countPdfPages, nestedRecapPath, validatePdf } from "./recap";
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
  addSessionFile,
  removeSessionFile,
  replaceSessionFile,
  deleteCampaignLocal,
  leaveCampaign,
  toggleVote,
  transferOrganizer,
} from "./model";
import { applyTheme, readStoredTheme } from "./theme";
import { StoreContext, type CampaignInput, type StoreApi } from "./store";
import type { AppState, AttendanceState, Cadence, Campaign, Invite, Member, Poll, Session, Toast } from "./types";

const STORAGE = "tpk-playdates-v1";

function isState(value: unknown): value is AppState {
  return !!value && typeof value === "object" && Array.isArray((value as AppState).campaigns) && !!(value as AppState).me;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => buildDemo("giada"));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
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
    setThemeState(readStoredTheme());
    const params = new URLSearchParams(window.location.search);
    if (params.get("demoLink") !== "1" && !params.get("as")) {
      try {
        const raw = window.localStorage.getItem(STORAGE);
        if (raw && isState(JSON.parse(raw))) setState(JSON.parse(raw) as AppState);
      } catch { /* keep the seed */ }
    }
    document.body.dataset.ready = "1";
  }, []);

  useEffect(() => {
    if (document.body.dataset.ready !== "1") return;
    if (new URLSearchParams(window.location.search).get("as")) return;
    if (!state.me.id) return;
    window.localStorage.setItem(STORAGE, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    setResolved(applyTheme(theme));
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
    setThemeState(next);
    window.localStorage.setItem("tpk-theme", next);
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
          if (!stateRef.current.me.id) {
            document.body.dataset.persona = "guest";
            return;
          }
          setState({
            ...stateRef.current,
            me: { id: "", email: "", displayName: "", tz: "America/Los_Angeles", calToken: "", canCreateCampaigns: false },
          });
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
      attachPdf: async (sessionId, file, onProgress) => {
        const problem = validatePdf(file);
        if (problem) return problem;
        const session = stateRef.current.sessions.find((item) => item.id === sessionId);
        if (!session) return "That session is gone.";
        for (const f of [0.35, 0.7, 1]) { onProgress?.(f); await new Promise((r) => setTimeout(r, 120)); }
        const path = nestedRecapPath(session.cid, session.id, `${Date.now()}-${file.name}`);
        pdfBlobs.current.set(path, URL.createObjectURL(file));
        setPdfRev((value) => value + 1);
        const pages = await countPdfPages(file);
        apply((s) => addSessionFile(s, sessionId, { path, name: file.name, size: file.size, pages }));
        return null;
      },
      replacePdf: async (sessionId, oldPath, file, onProgress) => {
        const problem = validatePdf(file);
        if (problem) return problem;
        const session = stateRef.current.sessions.find((item) => item.id === sessionId);
        if (!session) return "That session is gone.";
        for (const f of [0.5, 1]) { onProgress?.(f); await new Promise((r) => setTimeout(r, 120)); }
        const path = nestedRecapPath(session.cid, session.id, `${Date.now()}-${file.name}`);
        pdfBlobs.current.set(path, URL.createObjectURL(file));
        setPdfRev((value) => value + 1);
        const pages = await countPdfPages(file);
        apply((s) => replaceSessionFile(s, sessionId, oldPath, { path, name: file.name, size: file.size, pages }));
        return null;
      },
      removePdf: async (sessionId, path) => {
        const url = pdfBlobs.current.get(path);
        if (url) URL.revokeObjectURL(url);
        pdfBlobs.current.delete(path);
        apply((s) => removeSessionFile(s, sessionId, path));
      },
      fileUrl: async (sessionId, path) => {
        const memory = pdfBlobs.current.get(path);
        if (memory) return memory;
        const session = stateRef.current.sessions.find((item) => item.id === sessionId);
        if (session?.pdfUrl?.startsWith("/samples/")) return session.pdfUrl;
        if (path.startsWith("/samples/")) return path;
        return "/samples/wizard-of-wines.pdf";
      },
      coverUrl: async (path) => pdfBlobs.current.get(path) ?? null,
      uploadCover: async (cid, image) => {
        const path = `campaigns/${cid}/cover-${Date.now()}.jpg`;
        pdfBlobs.current.set(path, URL.createObjectURL(image));
        apply((s) => setCampaignPatch(s, cid, { cover: { src: "", path, focalX: 0.5, focalY: 0.5 } }));
        return true;
      },
      removeCover: (cid) => apply((s) => setCampaignPatch(s, cid, { cover: { src: "", path: null, focalX: 0.5, focalY: 0.5 } })),
      archiveCampaign: (cid, archived) => apply((s) => setCampaignPatch(s, cid, { status: archived ? "archived" : "active" })),
      deleteCampaign: async (cid) => {
        apply((s) => deleteCampaignLocal(s, cid));
        return true;
      },
      leaveCampaign: async (cid) => {
        const result = leaveCampaign(stateRef.current, cid);
        if ("error" in result) { flash(result.error, "err"); return false; }
        setState(result);
        return true;
      },
      patchMe: (cid, patch) => apply((s) => setMember(s, cid, s.me.id, patch)),
      setDisplayName: async (name) => {
        const clean = name.trim().slice(0, 40);
        if (!clean) return;
        const cur = stateRef.current;
        const members: AppState["members"] = {};
        for (const [cid, list] of Object.entries(cur.members)) members[cid] = list.map((m) => (m.id === cur.me.id ? { ...m, displayName: clean } : m));
        setState({ ...cur, me: { ...cur.me, displayName: clean, nameSet: true }, members });
      },
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
          flash("Locked in. It's a real session now.");
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
      createInvite: async (cid, role: Invite["role"], email?) => {
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
      sendMagicLink: async (email) => {
        window.sessionStorage.setItem("tpk-magic-email", email.trim());
        flash(`Preview link ready for ${email.trim()}. On the live site this is a real email.`);
      },
      finishMagicLink: async (email) => {
        const params = new URLSearchParams(window.location.search);
        const pending = window.sessionStorage.getItem("tpk-magic-email");
        if (params.get("demoLink") !== "1" && !email && !pending) return "not-link";
        const stored = (email || pending || "").trim();
        if (!stored) return "need-email";
        const person = stateRef.current.directory.find((user) => user.email.toLowerCase() === stored.toLowerCase());
        const me = person ?? {
          id: `mail-${stored.toLowerCase()}`,
          email: stored,
          displayName: "",
          nameSet: false,
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
        setState({
          ...stateRef.current,
          me: { id: "", email: "", displayName: "", tz: "America/Los_Angeles", calToken: "", canCreateCampaigns: false },
        });
        document.body.dataset.persona = "guest";
      },
      signedIn: Boolean(state.me.id),
    };
  }, [state, online, toasts, theme, resolvedTheme, setTheme, flash, commit, pdfRev]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
