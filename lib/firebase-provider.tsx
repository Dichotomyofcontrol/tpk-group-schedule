"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { magicLinkContinueUrl } from "./magic-link";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
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
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light");
  const [online, setOnline] = useState(true);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const toastId = useRef(1);
  const stateRef = useRef<AppState | null>(null);
  const coverCache = useRef(new Map<string, string>());
  stateRef.current = state;

  const flash = useCallback((text: string, tone?: Toast["tone"]) => {
    const id = toastId.current++;
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
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
    return onAuthStateChanged(auth, (user) => setAuthUser(user));
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
    setState(emptyState(me));
    const userRef = doc(db, "users", authUser.uid);
    void getDoc(userRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(userRef, { email: me.email, displayName: me.displayName, tz: me.tz, hiddenCids: [] });
      }
      await authedFetch("/api/auth/link", { method: "POST" }).catch(() => undefined);
    });

    const unsubs: Array<() => void> = [];
    const memberQuery = query(collectionGroup(db, "members"), where("uid", "==", authUser.uid));
    const unsubMembers = onSnapshot(memberQuery, (snap) => {
      const cids = snap.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id);
      for (const stop of unsubs) stop();
      unsubs.length = 0;
      for (const cid of cids) {
        unsubs.push(onSnapshot(doc(db, "campaigns", cid), (c) => {
          if (!c.exists()) return;
          const campaign = { ...(c.data() as Omit<Campaign, "id">), id: cid };
          setState((prev) => {
            if (!prev) return prev;
            const rest = prev.campaigns.filter((x) => x.id !== cid);
            return { ...prev, campaigns: [...rest, campaign] };
          });
        }));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "sessions"), (ss) => {
          const sessions = ss.docs.map((d) => sessionFrom(d.id, cid, d.data()));
          setState((prev) => prev ? { ...prev, sessions: [...prev.sessions.filter((s) => s.cid !== cid), ...sessions] } : prev);
        }));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "members"), (ms) => {
          const members = ms.docs.map((d) => ({ ...(d.data() as Omit<Member, "id">), id: d.id }));
          setState((prev) => prev ? { ...prev, members: { ...prev.members, [cid]: members } } : prev);
        }));
        unsubs.push(onSnapshot(collection(db, "campaigns", cid, "polls"), (ps) => {
          const polls = ps.docs.map((d) => {
            const data = d.data() as Omit<Poll, "id">;
            return { ...data, id: d.id, votes: data.votes || {} };
          });
          setState((prev) => prev ? { ...prev, polls: [...prev.polls.filter((p) => p.cid !== cid), ...polls] } : prev);
        }));
      }
    });
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
      for (const stop of unsubs) stop();
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
    state: emptyState({
      id: "",
      email: "",
      displayName: "",
      tz: "America/Los_Angeles",
      calToken: "",
      canCreateCampaigns: false,
    }),
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
    addPoll: () => undefined,
    nudge: () => undefined,
    createInvite: () => null,
    acceptInvite: () => false,
    signOut: async () => undefined,
    sendMagicLink: async (email: string, inviteToken?: string) => {
      if (!firebaseConfigured()) {
        flash("Firebase isn't configured on this deploy yet.", "err");
        return;
      }
      const res = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, invite: inviteToken }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const data = res ? await res.json().catch(() => ({})) as { error?: string; fallback?: boolean } : { fallback: true };
        if (!res || data.fallback || res.status >= 500) {
          // Branded email unavailable: fall back to Firebase's standard sign-in email.
          const { auth } = getFirebase();
          await sendSignInLinkToEmail(auth, email, { url: magicLinkContinueUrl(window.location.origin, inviteToken), handleCodeInApp: true });
        } else {
          throw new Error(data.error || "Couldn't send the sign-in link. Try again.");
        }
      }
      window.localStorage.setItem("tpk-email", email);
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
  }), [online, toasts, theme, resolvedTheme, setTheme, flash]);

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
        try {
          const { storage } = getFirebase();
          const { getBlob, ref } = await import("firebase/storage");
          const url = URL.createObjectURL(await getBlob(ref(storage, path)));
          coverCache.current.set(path, url);
          return url;
        } catch {
          return null;
        }
      },
      uploadCover: async (cid, image) => {
        const path = `campaigns/${cid}/cover-${Date.now()}.jpg`;
        try {
          const { storage, db } = getFirebase();
          const { ref, uploadBytes, deleteObject } = await import("firebase/storage");
          await uploadBytes(ref(storage, path), image, { contentType: "image/jpeg" });
          coverCache.current.set(path, URL.createObjectURL(image));
          const before = stateRef.current?.campaigns.find((c) => c.id === cid)?.cover?.path;
          const cover = { src: "", path, focalX: 0.5, focalY: 0.5 };
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
        if (campaign) void setDoc(doc(db, "campaigns", cid), campaign);
        const batch = writeBatch(db);
        for (const session of next.sessions.filter((s) => s.cid === cid)) {
          batch.set(doc(db, "campaigns", cid, "sessions", session.id), { ...session, attendance: attendanceMap(session.attendance) });
        }
        void batch.commit();
      },
      patchCampaign: (cid, patch) => {
        const next = applyLocal((s) => setCampaignPatch(s, cid, patch));
        const campaign = next?.campaigns.find((c) => c.id === cid);
        if (campaign) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", cid), campaign);
        }
      },
      patchMember: (cid, memberId, patch) => {
        const next = applyLocal((s) => setMember(s, cid, memberId, patch));
        const member = next?.members[cid]?.find((m) => m.id === memberId);
        if (member) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", cid, "members", memberId), member);
        }
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
        const created = next.campaigns[next.campaigns.length - 1];
        const { db } = getFirebase();
        void (async () => {
          await setDoc(doc(db, "campaigns", created.id), created);
          const member = next.members[created.id]?.[0];
          if (member) await setDoc(doc(db, "campaigns", created.id, "members", member.id), { ...member, uid: authUser.uid });
          for (const session of next.sessions.filter((s) => s.cid === created.id)) {
            await setDoc(doc(db, "campaigns", created.id, "sessions", session.id), omitUndefined({ ...session, attendance: attendanceMap(session.attendance) }));
          }
        })();
        return created.id;
      },
      toggleVote: (pollId, optionId) => {
        const next = applyLocal((s) => toggleVote(s, pollId, optionId));
        const poll = next?.polls.find((p) => p.id === pollId);
        if (poll) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", poll.cid, "polls", poll.id), poll, { merge: true });
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
        if (poll) void setDoc(doc(db, "campaigns", poll.cid, "polls", poll.id), poll);
        if (session) void persistSession(session);
        flash("Locked in. It's a real session now.");
      },
      addPoll: (cid, title, options) => {
        const result = addPoll(stateRef.current || state, cid, title, options);
        if ("error" in result) {
          flash(result.error, "err");
          return;
        }
        setState(result);
        const poll = result.polls[result.polls.length - 1];
        const { db } = getFirebase();
        void setDoc(doc(db, "campaigns", cid, "polls", poll.id), poll);
      },
      nudge: (pollId, uid) => {
        const next = applyLocal((s) => nudgePoll(s, pollId, uid));
        const poll = next?.polls.find((p) => p.id === pollId);
        if (poll) {
          const { db } = getFirebase();
          void setDoc(doc(db, "campaigns", poll.cid, "polls", poll.id), { nudges: poll.nudges }, { merge: true });
        }
        flash("Nudge saved. It emails them once reminders are connected.");
      },
      createInvite: (cid, role, email) => {
        const result = createInvite(stateRef.current || state, cid, role, email);
        if ("error" in result) {
          flash(result.error, "err");
          return null;
        }
        const invite = result.invites[result.invites.length - 1];
        void authedFetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cid, role, email }) })
          .then(async (res) => {
            if (!res.ok) throw new Error(await res.text());
            const body = await res.json() as { token?: string };
            if (body.token) {
              setState((prev) => prev ? { ...prev, invites: [...prev.invites, { ...invite, token: body.token! }] } : prev);
            }
          })
          .catch(() => flash("Couldn't create that invite on the server.", "err"));
        return invite.token;
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
      finishMagicLink: signedOut.finishMagicLink,
      signOut: async () => {
        await firebaseSignOut(getFirebase().auth);
      },
    };
  }, [state, authUser, signedOut, flash, persistSession]);

  return <StoreContext.Provider value={api ?? signedOut}>{children}</StoreContext.Provider>;
}
