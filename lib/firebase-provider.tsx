"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { summaryDocId, summaryFromDoc } from "./character-summary";
import { cadencePatchForMerge, campaignPatchForMerge } from "./cover-doc";
import { firebaseConfigured, getFirebase } from "./firebase-client";
import { applyTheme, readStoredTheme } from "./theme";
import { countPdfPages, nestedRecapPath, validatePdf } from "./recap";
import {
  acceptInvite as acceptInviteModel,
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
  addSessionFile,
  removeSessionFile,
  replaceSessionFile,
  deleteCampaignLocal,
  leaveCampaign,
} from "./model";
import { StoreContext, type CampaignInput, type StoreApi } from "./store";
import { omitUndefined } from "./omit";
import { rosterMutationResult, type RosterInput, type RosterPlayer } from "./roster";
import type { AppState, Attendance, AttendanceState, Campaign, Invite, Member, Poll, Session, SessionFile, Toast, User } from "./types";

function emptyState(me: User): AppState {
  return {
    me,
    directory: [me],
    campaigns: [],
    sessions: [],
    members: {},
    polls: [],
    invites: [],
    hiddenCids: [],
    groupStartedOn: "2024-10-18",
  };
}

function asAttendance(raw: unknown): Attendance[] {
  if (Array.isArray(raw)) return raw as Attendance[];
  if (raw && typeof raw === "object") return Object.values(raw as Record<string, Attendance>);
  return [];
}

/** Create the pending shell. An existing doc is an update, which the rules refuse, so a ready summary stays put. */
function queuePendingSummary(cid: string, name?: string) {
  const clean = name?.trim();
  if (!clean) return;
  const { db } = getFirebase();
  void setDoc(doc(db, "campaigns", cid, "characterSummaries", summaryDocId(clean)), {
    name: clean,
    status: "pending",
    updatedAt: new Date().toISOString(),
  }).catch(() => undefined);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sessionFrom(id: string, cid: string, data: DocumentData): Session {
  const extraPdfs = Array.isArray(data.extraPdfs)
    ? data.extraPdfs.filter((file): file is SessionFile => !!file && typeof file.path === "string" && typeof file.name === "string")
    : undefined;
  return omitUndefined({
    id,
    cid,
    seriesId: data.seriesId ?? null,
    occurrenceKey: data.occurrenceKey ?? null,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    tz: data.tz || "America/Los_Angeles",
    title: typeof data.title === "string" ? data.title : "",
    location: data.location || "",
    status: data.status === "cancelled" ? "cancelled" : "scheduled",
    exception: data.exception ?? null,
    requireRsvps: data.requireRsvps ?? null,
    notes: optionalString(data.notes),
    previouslyOn: optionalString(data.previouslyOn),
    seq: data.seq ?? 0,
    recapHtml: optionalString(data.recapHtml),
    recapText: optionalString(data.recapText),
    recapMarkdown: optionalString(data.recapMarkdown),
    pdfPath: optionalString(data.pdfPath),
    pdfName: optionalString(data.pdfName),
    pdfSize: typeof data.pdfSize === "number" ? data.pdfSize : undefined,
    pdfPages: typeof data.pdfPages === "number" ? data.pdfPages : undefined,
    pdfUrl: typeof data.pdfUrl === "string" && !data.pdfUrl.includes("token=") && !data.pdfUrl.startsWith("blob:")
      ? data.pdfUrl
      : undefined,
    extraPdfs: extraPdfs?.length ? extraPdfs : undefined,
    legacy: data.legacy && typeof data.legacy === "object" ? data.legacy as Record<string, unknown> : undefined,
    attendance: asAttendance(data.attendance),
    reminder3dSent: typeof data.reminder3dSent === "boolean" ? data.reminder3dSent : undefined,
    reminder3hSent: typeof data.reminder3hSent === "boolean" ? data.reminder3hSent : undefined,
  });
}

function attendanceMap(list: Attendance[]): Record<string, Attendance> {
  const out: Record<string, Attendance> = {};
  for (const row of list) out[row.uid] = row;
  return out;
}

/** API routes verify a Firebase ID token, so every call carries the signed-in user's bearer. */
async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const user = getFirebase().auth.currentUser;
  const token = user ? await user.getIdToken().catch(() => "") : "";
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("dark");
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("dark");
  const [online, setOnline] = useState(true);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authKnown, setAuthKnown] = useState(false);
  const toastId = useRef(1);
  const stateRef = useRef<AppState | null>(null);
  const coverCache = useRef(new Map<string, string>());
  // createCampaign's document write is in flight until this resolves. Cover uploads wait for it.
  const creatingRef = useRef(new Map<string, Promise<void>>());
  const detachRef = useRef<(cid: string) => void>(() => undefined);
  stateRef.current = state;

  const flash = useCallback((text: string, tone?: Toast["tone"], action?: Toast["action"]) => {
    const id = toastId.current++;
    setToasts((list) => [...list, { id, text, tone, action }]);
    // A toast with Undo stays a little longer so there's time to reach it.
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), action ? 7000 : 4200);
  }, []);

  useEffect(() => {
    setThemeState(readStoredTheme());
    document.body.dataset.ready = "1";
  }, []);

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

  useEffect(() => {
    if (!firebaseConfigured()) return;
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (user) => { setAuthUser(user); setAuthKnown(true); });
  }, []);

  useEffect(() => {
    if (!authUser || !firebaseConfigured()) {
      if (!authUser) setState(null);
      return;
    }
    const { db } = getFirebase();
    const me: User = {
      id: authUser.uid,
      email: authUser.email || "",
      // Never the email prefix. Until the player picks a name, the account sheet asks for one.
      displayName: authUser.displayName || window.localStorage.getItem("tpk-name") || "",
      nameSet: false,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
      calToken: "",
      canCreateCampaigns: false,
    };
    setState({ ...emptyState(me), syncing: true });
    const userRef = doc(db, "users", authUser.uid);
    void getDoc(userRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(userRef, { email: me.email, displayName: me.displayName, tz: me.tz, hiddenCids: [] });
      }
      await authedFetch("/api/auth/link", { method: "POST" }).catch(() => undefined);
    });

    // Per-campaign listeners, keyed by cid, so one campaign joining or leaving never tears down the rest.
    const live = new Map<string, Array<() => void>>();
    const detach = (cid: string) => { for (const stop of live.get(cid) || []) stop(); live.delete(cid); };
    detachRef.current = detach;
    const memberQuery = query(collectionGroup(db, "members"), where("uid", "==", authUser.uid));
    // includeMetadataChanges: a member doc we just wrote shows up locally before the server has it.
    // Attaching campaign listeners then is what caused permission-denied/400s on create, so wait for the commit.
    const unsubMembers = onSnapshot(memberQuery, { includeMetadataChanges: true }, (snap) => {
      const cids = snap.docs.filter((d) => !d.metadata.hasPendingWrites).map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id);
      for (const cid of [...live.keys()]) if (!cids.includes(cid)) detach(cid);
      const fresh = cids.filter((cid) => !live.has(cid));
      // First paint waits for each campaign doc and its sessions, so screens never flash "No sessions yet".
      const pending = new Set(fresh.flatMap((cid) => [`c:${cid}`, `s:${cid}`]));
      const settle = (key: string) => {
        if (!pending.delete(key) || pending.size) return;
        setState((prev) => prev && prev.syncing ? { ...prev, syncing: false } : prev);
      };
      if (!pending.size && !snap.metadata.fromCache) setState((prev) => prev && prev.syncing ? { ...prev, syncing: false } : prev);
      for (const cid of fresh) {
        const unsubs: Array<() => void> = [];
        live.set(cid, unsubs);
        // A listener that loses access (campaign deleted, member removed) just stops quietly.
        const lost = () => detach(cid);
        unsubs.push(onSnapshot(doc(db, "campaigns", cid), (c) => {
          if (!c.exists()) { settle(`c:${cid}`); return; }
          const campaign = { ...(c.data() as Omit<Campaign, "id">), id: cid };
          setState((prev) => {
            if (!prev) return prev;
            const rest = prev.campaigns.filter((x) => x.id !== cid);
            return { ...prev, campaigns: [...rest, campaign] };
          });
          settle(`c:${cid}`);
        }, () => { settle(`c:${cid}`); lost(); }));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "sessions"), (ss) => {
          const sessions = ss.docs.map((d) => sessionFrom(d.id, cid, d.data()));
          setState((prev) => prev ? { ...prev, sessions: [...prev.sessions.filter((s) => s.cid !== cid), ...sessions] } : prev);
          settle(`s:${cid}`);
        }, () => { settle(`s:${cid}`); lost(); }));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "members"), (ms) => {
          const members = ms.docs.map((d) => ({ ...(d.data() as Omit<Member, "id">), id: d.id }));
          setState((prev) => prev ? { ...prev, members: { ...prev.members, [cid]: members } } : prev);
        }, lost));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "characterSummaries"), (cs) => {
          const summaries = cs.docs.flatMap((d) => {
            const summary = summaryFromDoc(d.data() as Record<string, unknown>, d.id);
            return summary ? [summary] : [];
          });
          setState((prev) => prev ? { ...prev, characterSummaries: { ...prev.characterSummaries, [cid]: summaries } } : prev);
        }, () => undefined));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "polls"), (ps) => {
          const polls = ps.docs.map((d) => {
            const data = d.data() as Omit<Poll, "id">;
            return { ...data, id: d.id, votes: data.votes || {} };
          });
          setState((prev) => prev ? { ...prev, polls: [...prev.polls.filter((p) => p.cid !== cid), ...polls] } : prev);
        }, lost));
      }
    }, () => setState((prev) => prev && prev.syncing ? { ...prev, syncing: false } : prev));
    const unsubUser = onSnapshot(userRef, (snap) => {
      const data = snap.data() || {};
      setState((prev) => prev ? {
        ...prev,
        hiddenCids: data.hiddenCids || prev.hiddenCids,
        me: {
          ...prev.me,
          calToken: data.calToken || prev.me.calToken,
          displayName: data.nameSet ? data.displayName : (prev.me.displayName || ""),
          nameSet: !!data.nameSet,
          canCreateCampaigns: !!data.canCreateCampaigns || prev.me.canCreateCampaigns,
        },
      } : prev);
    });
    const unsubAllow = onSnapshot(doc(db, "config", "allowlist"), (snap) => {
      const emails: string[] = snap.data()?.emails || [];
      const allowed = emails.map((e) => e.toLowerCase()).includes((authUser.email || "").toLowerCase());
      setState((prev) => prev ? { ...prev, me: { ...prev.me, canCreateCampaigns: allowed || prev.me.canCreateCampaigns } } : prev);
    });
    return () => {
      unsubMembers();
      unsubUser();
      unsubAllow();
      for (const cid of [...live.keys()]) detach(cid);
    };
  }, [authUser]);

  // Keep my name the same on every table: if any of my member docs carries an old or
  // missing name (for example from an invite accepted before I set one), fix it.
  const syncedName = useRef("");
  useEffect(() => {
    if (!authUser || !state?.me.nameSet || !state.me.displayName) return;
    const name = state.me.displayName;
    const stale = Object.entries(state.members).filter(([, list]) => list.some((m) => m.id === authUser.uid && m.displayName !== name)).map(([cid]) => cid);
    const key = `${name}|${stale.join(",")}`;
    if (!stale.length || syncedName.current === key) return;
    syncedName.current = key;
    const { db } = getFirebase();
    for (const cid of stale) void setDoc(doc(db, "campaigns", cid, "members", authUser.uid), { displayName: name }, { merge: true }).catch(() => undefined);
  }, [authUser, state]);

  const persistSession = useCallback(async (session: Session) => {
    const { db } = getFirebase();
    const payload = omitUndefined({ ...session, attendance: attendanceMap(session.attendance) });
    await setDoc(doc(db, "campaigns", session.cid, "sessions", session.id), payload);
  }, []);

  const setTheme = useCallback((next: "light" | "dark" | "system") => {
    setThemeState(next);
    window.localStorage.setItem("tpk-theme", next);
  }, []);

  const signedOut: StoreApi = useMemo(() => ({
    state: { ...emptyState({
      id: "",
      email: "",
      displayName: "",
      tz: "America/Los_Angeles",
      calToken: "",
      canCreateCampaigns: false,
    }), syncing: firebaseConfigured() && (!authKnown || !!authUser) },
    // Until Firebase says who this is (or while a signed-in user's data spins up), screens show the skeleton, not "You're not at a table yet".
    mode: "live",
    online,
    toasts,
    theme,
    resolvedTheme,
    setTheme,
    dismissToast: (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    flash,
    setPersona: () => undefined,
    resetDemo: () => undefined,
    toggleHidden: () => undefined,
    mark: () => undefined,
    skip: () => undefined,
    cancel: () => undefined,
    restore: () => undefined,
    move: () => undefined,
    editSession: () => undefined,
    saveRecap: () => undefined,
    attachPdf: async () => "Sign in first.",
    replacePdf: async () => "Sign in first.",
    removePdf: async () => undefined,
    fileUrl: async () => null,
    coverUrl: async () => null,
    uploadCover: async () => false,
    removeCover: () => undefined,
    archiveCampaign: () => undefined,
    deleteCampaign: async () => false,
    leaveCampaign: async () => false,
    patchMe: () => undefined,
    setDisplayName: async () => undefined,
    saveCadence: () => undefined,
    patchCampaign: () => undefined,
    patchMember: () => undefined,
    transfer: () => undefined,
    removeMember: () => undefined,
    createCampaign: () => null,
    toggleVote: () => undefined,
    lockPoll: () => undefined,
    addPoll: () => null,
    replacePoll: () => undefined,
    mergeGuestBallots: () => undefined,
    createOneShot: () => null,
    nudge: () => undefined,
    createInvite: async () => null,
    rosterList: async () => [],
    rosterAdd: async () => ({ error: "Sign in first." }),
    rosterSave: async () => ({ error: "Sign in first." }),
    rosterShare: async () => ({ error: "Sign in first." }),
    rosterRemove: async () => false,
    claimSeat: async () => ({ ok: false, error: "Sign in first." }),
    acceptInvite: () => false,
    signOut: async () => undefined,
    sendMagicLink: async (email: string, inviteToken?: string) => {
      if (!firebaseConfigured()) {
        const message = "Firebase isn't configured on this deploy yet.";
        flash(message, "err");
        throw new Error(message);
      }
      const res = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, invite: inviteToken }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) as { error?: string } : {};
      if (!res?.ok) throw new Error(data.error || "Couldn't send the sign-in email. Try again.");
      window.localStorage.setItem("tpk-email", email);
    },
    completeSignInCode: async (email: string, code: string) => {
      if (!firebaseConfigured()) throw new Error("Firebase isn't configured on this deploy yet.");
      const res = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) as { error?: string; link?: string } : {};
      if (!res?.ok || !data.link) throw new Error(data.error || "That code didn't work. Check it, or request a new email.");
      const { auth } = getFirebase();
      await signInWithEmailLink(auth, email.trim(), data.link);
      window.localStorage.setItem("tpk-email", email.trim());
    },
    finishMagicLink: async (email?: string) => {
      if (!firebaseConfigured()) return "not-link";
      const { auth } = getFirebase();
      const href = window.location.href;
      if (!isSignInWithEmailLink(auth, href)) return "not-link";
      const stored = (email || window.localStorage.getItem("tpk-email") || "").trim();
      if (!stored) return "need-email";
      await signInWithEmailLink(auth, stored, href);
      window.localStorage.setItem("tpk-email", stored);
      return "ok";
    },
    signedIn: false,
    signedOutConfirmed: authKnown && !authUser,
  }), [online, toasts, theme, resolvedTheme, setTheme, flash, authKnown, authUser]);

  const api = useMemo<StoreApi | null>(() => {
    if (!state || !authUser) return null;
    const applyLocal = (fn: (current: AppState) => AppState | { error: string }) => {
      const current = stateRef.current;
      if (!current) return null;
      const result = fn(current);
      if ("error" in result) {
        flash(result.error, "err");
        return null;
      }
      stateRef.current = result;
      setState(result);
      return result;
    };
    const uploadRecap = async (sessionId: string, file: File, oldPath: string | null, onProgress?: (f: number) => void): Promise<string | null> => {
      const problem = validatePdf(file);
      if (problem) return problem;
      const current = stateRef.current?.sessions.find((s) => s.id === sessionId);
      if (!current) return "That session is gone.";
      const path = nestedRecapPath(current.cid, current.id, `${Date.now().toString(36)}-${file.name}`);
      try {
        const { storage } = getFirebase();
        const { ref, uploadBytesResumable } = await import("firebase/storage");
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(ref(storage, path), file, { contentType: "application/pdf" });
          task.on("state_changed", (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0), reject, () => resolve());
        });
        const entry = { path, name: file.name, size: file.size, pages: await countPdfPages(file) };
        const next = applyLocal((s) => (oldPath ? replaceSessionFile(s, sessionId, oldPath, entry) : addSessionFile(s, sessionId, entry)));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) await persistSession(session);
        if (oldPath && oldPath.startsWith(`recaps/${current.cid}/${current.id}/`)) {
          const { deleteObject } = await import("firebase/storage");
          await deleteObject(ref(storage, oldPath)).catch(() => undefined);
        }
        return null;
      } catch {
        return "Couldn't upload that PDF. Check your connection and try again.";
      }
    };
    return {
      ...signedOut,
      state,
      signedIn: true,
      setPersona: () => flash("Personas are only in the sample table."),
      resetDemo: () => undefined,
      toggleHidden: (cid) => {
        const current = stateRef.current;
        if (!current) return;
        const hidden = new Set(current.hiddenCids);
        if (hidden.has(cid)) hidden.delete(cid);
        else hidden.add(cid);
        const hiddenCids = [...hidden];
        setState({ ...current, hiddenCids });
        const { db } = getFirebase();
        void setDoc(doc(db, "users", authUser.uid), { hiddenCids }, { merge: true });
      },
      mark: (sessionId, uid, attendance: AttendanceState, note?) => {
        const next = applyLocal((s) => markAttendance(s, sessionId, uid, attendance, note));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session).catch(() => flash("Couldn't save that. You're still seeing it here.", "err"));
      },
      skip: (sessionId) => {
        const next = applyLocal((s) => skipSession(s, sessionId));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session);
      },
      cancel: (sessionId) => {
        const next = applyLocal((s) => cancelSession(s, sessionId));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session);
      },
      restore: (sessionId) => {
        const next = applyLocal((s) => restoreSession(s, sessionId));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session);
      },
      move: (sessionId, ymd, hm, location) => {
        const next = applyLocal((s) => moveSession(s, sessionId, ymd, hm, location));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session);
      },
      editSession: (sessionId, patch) => {
        const next = applyLocal((s) => editSession(s, sessionId, patch));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session);
      },
      saveRecap: (sessionId, patch) => {
        const before = stateRef.current?.sessions.find((s) => s.id === sessionId);
        const next = applyLocal((s) => saveRecap(s, sessionId, patch));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) void persistSession(session);
        const campaign = next?.campaigns.find((c) => c.id === before?.cid);
        if (campaign) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", campaign.id), {
            previouslyOn: campaign.previouslyOn ?? null,
            previouslyOnSessionId: campaign.previouslyOnSessionId ?? null,
          }, { merge: true });
        }
      },
      attachPdf: (sessionId, file, onProgress) => uploadRecap(sessionId, file, null, onProgress),
      replacePdf: (sessionId, oldPath, file, onProgress) => uploadRecap(sessionId, file, oldPath, onProgress),
      removePdf: async (sessionId, path) => {
        const next = applyLocal((s) => removeSessionFile(s, sessionId, path));
        const session = next?.sessions.find((s) => s.id === sessionId);
        if (session) await persistSession(session).catch(() => flash("Couldn't remove that file.", "err"));
        // Files this app uploaded live under recaps/{cid}/{sid}/. Legacy files stay put in Storage.
        if (session && path.startsWith(`recaps/${session.cid}/${session.id}/`)) {
          const { storage } = getFirebase();
          const { ref, deleteObject } = await import("firebase/storage");
          await deleteObject(ref(storage, path)).catch(() => undefined);
        }
      },
      fileUrl: async (sessionId, path, download = false) => {
        const session = stateRef.current?.sessions.find((s) => s.id === sessionId);
        if (!session) return null;
        if (path.startsWith("/samples/") || /^https?:/.test(path)) return path;
        try {
          const res = await authedFetch("/api/files", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ cid: session.cid, sid: sessionId, path, download }),
          });
          if (res.ok) {
            const body = await res.json() as { url?: string };
            if (body.url) return body.url;
          }
        } catch { /* fall back to the SDK below */ }
        try {
          const { storage } = getFirebase();
          const { getBlob, ref } = await import("firebase/storage");
          const blob = await getBlob(ref(storage, path));
          return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        } catch {
          return null;
        }
      },
      coverUrl: async (path) => {
        const hit = coverCache.current.get(path);
        if (hit) return hit;
        const { storage, auth } = getFirebase();
        const { getDownloadURL, ref } = await import("firebase/storage");
        // getBlob pulls the bytes through XHR and, on a miss, the hero paints the
        // empty default. A download URL is what an <img> can load after refresh.
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            if (auth.currentUser) await auth.currentUser.getIdToken();
            const url = await getDownloadURL(ref(storage, path));
            coverCache.current.set(path, url);
            return url;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
        return null;
      },
      uploadCover: async (cid, image) => {
        // The create write replaces the whole document. Wait until it has landed
        // so it cannot overwrite this cover with { path: null }.
        const gate = creatingRef.current.get(cid);
        if (gate) {
          try { await gate; } catch { return false; }
        }
        const path = `campaigns/${cid}/cover-${Date.now()}.jpg`;
        try {
          const { storage, db } = getFirebase();
          const { ref, uploadBytes, deleteObject, getDownloadURL } = await import("firebase/storage");
          const stored = ref(storage, path);
          await uploadBytes(stored, image, { contentType: "image/jpeg" });
          const src = await getDownloadURL(stored).catch(() => "");
          coverCache.current.set(path, src || URL.createObjectURL(image));
          const before = stateRef.current?.campaigns.find((c) => c.id === cid)?.cover?.path;
          const cover = { src, path, focalX: 0.5, focalY: 0.5 };
          applyLocal((s) => setCampaignPatch(s, cid, { cover }));
          await setDoc(doc(db, "campaigns", cid), { cover }, { merge: true });
          if (before && before !== path) await deleteObject(ref(storage, before)).catch(() => undefined);
          return true;
        } catch {
          flash("Couldn't upload that cover.", "err");
          return false;
        }
      },
      removeCover: (cid) => {
        const before = stateRef.current?.campaigns.find((c) => c.id === cid)?.cover?.path;
        const cover = { src: "", path: null, focalX: 0.5, focalY: 0.5 };
        applyLocal((s) => setCampaignPatch(s, cid, { cover }));
        const { db, storage } = getFirebase();
        void setDoc(doc(db, "campaigns", cid), { cover }, { merge: true });
        if (before) void import("firebase/storage").then(({ ref, deleteObject }) => deleteObject(ref(storage, before)).catch(() => undefined));
      },
      archiveCampaign: (cid, archived) => {
        const status = archived ? "archived" as const : "active" as const;
        applyLocal((s) => setCampaignPatch(s, cid, { status }));
        const { db } = getFirebase();
        void setDoc(doc(db, "campaigns", cid), { status }, { merge: true })
          .then(() => flash(archived ? "Archived. Restore it any time from Campaigns." : "Restored."))
          .catch(() => flash("Couldn't change that.", "err"));
      },
      deleteCampaign: async (cid) => {
        // Stop listening first: the server deletes the member docs, and live listeners would hit permission-denied.
        detachRef.current(cid);
        const res = await authedFetch(`/api/campaigns/${cid}`, { method: "DELETE" }).catch(() => null);
        if (!res || !res.ok) {
          flash("Couldn't delete that campaign.", "err");
          return false;
        }
        applyLocal((s) => deleteCampaignLocal(s, cid));
        return true;
      },
      leaveCampaign: async (cid) => {
        const result = leaveCampaign(stateRef.current!, cid);
        if ("error" in result) { flash(result.error, "err"); return false; }
        try {
          const { db } = getFirebase();
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "campaigns", cid, "members", authUser.uid));
          setState(result);
          return true;
        } catch {
          flash("Couldn't leave that campaign.", "err");
          return false;
        }
      },
      patchMe: (cid, patch) => {
        const next = applyLocal((s) => setMember(s, cid, authUser.uid, patch));
        if (!next) return;
        const { db } = getFirebase();
        void setDoc(doc(db, "campaigns", cid, "members", authUser.uid), patch, { merge: true })
          .catch(() => flash("Couldn't save that.", "err"));
        queuePendingSummary(cid, patch.characterName);
      },
      setDisplayName: async (name) => {
        const clean = name.trim().slice(0, 40);
        if (!clean) return;
        const cur = stateRef.current;
        if (!cur) return;
        const members: AppState["members"] = {};
        for (const [cid, list] of Object.entries(cur.members)) members[cid] = list.map((m) => (m.id === authUser.uid ? { ...m, displayName: clean } : m));
        setState({ ...cur, me: { ...cur.me, displayName: clean, nameSet: true }, members });
        window.localStorage.setItem("tpk-name", clean);
        const { db } = getFirebase();
        await setDoc(doc(db, "users", authUser.uid), { displayName: clean, nameSet: true }, { merge: true });
        for (const [cid, list] of Object.entries(cur.members)) {
          if (list.some((m) => m.id === authUser.uid)) {
            await setDoc(doc(db, "campaigns", cid, "members", authUser.uid), { displayName: clean }, { merge: true }).catch(() => undefined);
          }
        }
      },
      saveCadence: (cid, cadence) => {
        const next = applyLocal((s) => applyCadence(s, cid, cadence));
        if (!next) return;
        const { db } = getFirebase();
        const campaign = next.campaigns.find((c) => c.id === cid);
        // Merge the schedule only. A full setDoc replaced cover.path and the
        // hero fell back to the empty strip after refresh.
        if (campaign) void setDoc(doc(db, "campaigns", cid), cadencePatchForMerge(campaign), { merge: true });
        const batch = writeBatch(db);
        for (const session of next.sessions.filter((s) => s.cid === cid)) {
          batch.set(doc(db, "campaigns", cid, "sessions", session.id), { ...session, attendance: attendanceMap(session.attendance) });
        }
        void batch.commit();
      },
      patchCampaign: (cid, patch) => {
        const next = applyLocal((s) => setCampaignPatch(s, cid, patch));
        if (!next) return;
        const data = campaignPatchForMerge(patch);
        if (!Object.keys(data).length) return;
        const { db } = getFirebase();
        void setDoc(doc(db, "campaigns", cid), data, { merge: true });
      },
      patchMember: (cid, memberId, patch) => {
        const next = applyLocal((s) => setMember(s, cid, memberId, patch));
        const member = next?.members[cid]?.find((m) => m.id === memberId);
        if (member) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", cid, "members", memberId), member);
        }
        queuePendingSummary(cid, patch.characterName);
      },
      transfer: (cid, uid) => {
        void authedFetch(`/api/campaigns/${cid}/transfer`, { method: "POST", body: JSON.stringify({ uid }) });
        applyLocal((s) => transferOrganizer(s, cid, uid));
      },
      removeMember: (cid, memberId) => {
        applyLocal((s) => removeMember(s, cid, memberId));
        const { db } = getFirebase();
        void import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(doc(db, "campaigns", cid, "members", memberId)));
      },
      createCampaign: (input: CampaignInput) => {
        const next = createCampaign(stateRef.current || state, input);
        if ("error" in next) {
          flash(next.error, "err");
          return null;
        }
        setState(next);
        stateRef.current = next;
        const created = next.campaigns[next.campaigns.length - 1];
        const { db } = getFirebase();
        const pending = (async () => {
          await setDoc(doc(db, "campaigns", created.id), omitUndefined(created));
          const member = next.members[created.id]?.[0];
          if (member) await setDoc(doc(db, "campaigns", created.id, "members", member.id), { ...member, uid: authUser.uid });
          for (const session of next.sessions.filter((s) => s.cid === created.id)) {
            await setDoc(doc(db, "campaigns", created.id, "sessions", session.id), omitUndefined({ ...session, attendance: attendanceMap(session.attendance) }));
          }
        })();
        const gated = pending.catch(() => {
          flash("Couldn't save that campaign. Check your connection and try again.", "err");
          throw new Error("create");
        });
        creatingRef.current.set(created.id, gated);
        void gated.catch(() => undefined);
        return created.id;
      },
      toggleVote: (pollId, optionId) => {
        const uid = (stateRef.current || state).me.id;
        const next = applyLocal((s) => toggleVote(s, pollId, optionId));
        const poll = next?.polls.find((p) => p.id === pollId);
        const vote = uid ? poll?.votes[uid] : undefined;
        // Write only this person's ballot so a guest vote landing at the same time stays put.
        if (poll && vote) {
          const { db } = getFirebase();
          void updateDoc(doc(db, "campaigns", poll.cid, "polls", poll.id), { [`votes.${uid}`]: vote });
        }
      },
      lockPoll: (pollId, optionId) => {
        const result = lockPoll(stateRef.current || state, pollId, optionId);
        if ("error" in result) {
          flash(result.error, "err");
          return;
        }
        setState(result);
        const poll = result.polls.find((p) => p.id === pollId);
        const session = result.sessions.find((s) => s.id === poll?.sessionId);
        const { db } = getFirebase();
        if (poll) {
          void updateDoc(doc(db, "campaigns", poll.cid, "polls", poll.id), {
            status: poll.status,
            chosenOptionId: poll.chosenOptionId ?? null,
            sessionId: poll.sessionId ?? null,
          });
        }
        if (session) void persistSession(session);
        flash("Locked in. It's a real session now.");
      },
      addPoll: (cid, title, options) => {
        const result = addPoll(stateRef.current || state, cid, title, options);
        if ("error" in result) {
          flash(result.error, "err");
          return null;
        }
        setState(result);
        const poll = result.polls[result.polls.length - 1];
        const { db } = getFirebase();
        void setDoc(doc(db, "campaigns", cid, "polls", poll.id), poll);
        return poll?.id ?? null;
      },
      replacePoll: () => undefined,
      mergeGuestBallots: () => undefined,
      createOneShot: (input) => {
        const made = createCampaign(stateRef.current || state, { name: input.title, color: "#ce93d8", icon: "✨", tz: input.tz, location: input.location, requireRsvps: false, allowMemberInvites: true, cadence: null, kind: "oneshot" });
        if ("error" in made) { flash(made.error, "err"); return null; }
        const created = made.campaigns[made.campaigns.length - 1];
        const polled = addPoll(made, created.id, "Which night works?", input.options);
        if ("error" in polled) { flash(polled.error, "err"); return null; }
        setState(polled);
        stateRef.current = polled;
        const poll = polled.polls[polled.polls.length - 1];
        const member = polled.members[created.id]?.[0];
        const { db } = getFirebase();
        // In order: the rules only let the organizer write the poll once their member doc exists.
        const pending = (async () => {
          await setDoc(doc(db, "campaigns", created.id), omitUndefined(created));
          if (member) await setDoc(doc(db, "campaigns", created.id, "members", member.id), { ...member, uid: authUser.uid });
          await setDoc(doc(db, "campaigns", created.id, "polls", poll.id), poll);
        })();
        const gated = pending.catch(() => {
          flash("Couldn't save the one-shot. Check your connection and try again.", "err");
          throw new Error("create");
        });
        creatingRef.current.set(created.id, gated);
        void gated.catch(() => undefined);
        return created.id;
      },
      nudge: (pollId, uid) => {
        const next = applyLocal((s) => nudgePoll(s, pollId, uid));
        const poll = next?.polls.find((p) => p.id === pollId);
        if (poll) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", poll.cid, "polls", poll.id), { nudges: poll.nudges }, { merge: true });
        }
      },
      createInvite: async (cid, role, email) => {
        const result = createInvite(stateRef.current || state, cid, role, email);
        if ("error" in result) {
          flash(result.error, "err");
          return null;
        }
        // The server mints the real token. Only show and copy that one; the local
        // placeholder token never exists in Firestore and opens as "isn't open".
        const draft = result.invites[result.invites.length - 1];
        try {
          const res = await authedFetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cid, role, email }) });
          if (!res.ok) throw new Error(await res.text());
          const body = await res.json() as { token?: string };
          if (!body.token) throw new Error("no token");
          const token = body.token;
          setState((prev) => prev ? { ...prev, invites: [...prev.invites, { ...draft, token }] } : prev);
          return token;
        } catch {
          flash("Couldn't create that invite. Try again.", "err");
          return null;
        }
      },
      rosterList: async (cid) => {
        const res = await authedFetch(`/api/campaigns/${encodeURIComponent(cid)}/roster`).catch(() => null);
        if (!res?.ok) return [];
        const body = await res.json() as { players?: RosterPlayer[] };
        return body.players || [];
      },
      rosterAdd: async (cid, input: RosterInput) => {
        const res = await authedFetch(`/api/campaigns/${encodeURIComponent(cid)}/roster`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
        }).catch(() => null);
        const result = await rosterMutationResult(res, "Couldn't add that player.");
        if ("error" in result) return result;
        return result.player;
      },
      rosterSave: async (cid, id, input: RosterInput) => {
        const res = await authedFetch(`/api/campaigns/${encodeURIComponent(cid)}/roster/${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
        }).catch(() => null);
        const result = await rosterMutationResult(res, "Couldn't save that player.");
        if ("error" in result) return result;
        return result.player;
      },
      rosterShare: async (cid, id) => {
        const res = await authedFetch(`/api/campaigns/${encodeURIComponent(cid)}/roster/${encodeURIComponent(id)}/share`, { method: "POST" }).catch(() => null);
        const result = await rosterMutationResult(res, "Couldn't save that the link was copied.");
        if ("error" in result) return result;
        return result.player;
      },
      rosterRemove: async (cid, id) => {
        const res = await authedFetch(`/api/campaigns/${encodeURIComponent(cid)}/roster/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
        return !!res?.ok;
      },
      claimSeat: async (token) => {
        const res = await authedFetch(`/api/join/${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
        const body = res ? await res.json().catch(() => ({})) as {
          ok?: boolean; error?: string; cid?: string; campaignName?: string; member?: Member | null;
          player?: { id: string; name: string; characterName?: string; status: RosterPlayer["status"]; memberId?: string };
          created?: boolean; linked?: boolean; already?: boolean;
        } : {};
        if (!res?.ok || !body.ok || !body.player || !body.cid || !body.campaignName) return { ok: false as const, error: body.error || "Couldn't claim that seat." };
        return {
          ok: true as const,
          campaignName: body.campaignName,
          cid: body.cid,
          player: body.player,
          member: body.member || null,
          created: !!body.created,
          linked: !!body.linked,
          already: !!body.already,
        };
      },
      acceptInvite: (token, person) => {
        const me = person ?? { id: authUser.uid, email: authUser.email || "", displayName: state.me.displayName };
        void authedFetch(`/api/invites/${token}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(me) })
          .then(async (res) => {
            if (!res.ok) flash("Couldn't accept that invite.", "err");
          });
        const local = acceptInviteModel(stateRef.current || state, token, { ...me, id: state.me.id });
        if (!("error" in local)) setState(local);
        return true;
      },
      sendMagicLink: signedOut.sendMagicLink,
      completeSignInCode: signedOut.completeSignInCode,
      finishMagicLink: signedOut.finishMagicLink,
      signOut: async () => {
        await firebaseSignOut(getFirebase().auth);
      },
    };
  }, [state, authUser, signedOut, flash, persistSession]);

  return <StoreContext.Provider value={api ?? signedOut}>{children}</StoreContext.Provider>;
}
