"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
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
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { firebaseConfigured, getFirebase } from "./firebase-client";
import { nestedRecapPath, validatePdf } from "./recap";
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
} from "./model";
import { StoreContext, type CampaignInput, type StoreApi } from "./store";
import type { AppState, Attendance, AttendanceState, Campaign, Invite, Member, Poll, Session, Toast, User } from "./types";

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

function sessionFrom(id: string, cid: string, data: DocumentData): Session {
  return {
    id,
    cid,
    seriesId: data.seriesId ?? null,
    occurrenceKey: data.occurrenceKey ?? null,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    tz: data.tz || "America/Los_Angeles",
    title: data.title || "Session",
    location: data.location || "",
    status: data.status === "cancelled" ? "cancelled" : "scheduled",
    exception: data.exception ?? null,
    requireRsvps: data.requireRsvps ?? null,
    snackUid: data.snackUid ?? null,
    notes: data.notes,
    seq: data.seq ?? 0,
    recapHtml: data.recapHtml,
    recapText: data.recapText,
    recapMarkdown: data.recapMarkdown,
    pdfPath: data.pdfPath,
    pdfName: data.pdfName,
    pdfUrl: typeof data.pdfUrl === "string" && !data.pdfUrl.includes("token=") && !data.pdfUrl.startsWith("blob:")
      ? data.pdfUrl
      : undefined,
    legacy: data.legacy,
    attendance: asAttendance(data.attendance),
    reminder3dSent: data.reminder3dSent,
    reminder3hSent: data.reminder3hSent,
  };
}

function attendanceMap(list: Attendance[]): Record<string, Attendance> {
  const out: Record<string, Attendance> = {};
  for (const row of list) out[row.uid] = row;
  return out;
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light");
  const [online, setOnline] = useState(true);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const toastId = useRef(1);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

  const flash = useCallback((text: string, tone?: Toast["tone"]) => {
    const id = toastId.current++;
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("tpk-theme");
    if (saved === "light" || saved === "dark" || saved === "system") setThemeState(saved);
    document.body.dataset.ready = "1";
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      setResolved(dark ? "dark" : "light");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
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
      displayName: authUser.displayName || window.localStorage.getItem("tpk-name") || authUser.email?.split("@")[0] || "Player",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
      calToken: "",
      canCreateCampaigns: false,
    };
    setState(emptyState(me));
    const userRef = doc(db, "users", authUser.uid);
    void getDoc(userRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(userRef, { email: me.email, displayName: me.displayName, tz: me.tz, hiddenCids: ["special"] });
      }
      await fetch("/api/auth/link", { method: "POST" }).catch(() => undefined);
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
        me: { ...prev.me, calToken: data.calToken || prev.me.calToken, displayName: data.displayName || prev.me.displayName, canCreateCampaigns: !!data.canCreateCampaigns },
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

  const persistSession = useCallback(async (session: Session) => {
    const { db } = getFirebase();
    const payload = { ...session, attendance: attendanceMap(session.attendance) };
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
    attachPdf: async () => undefined,
    clearPdf: () => undefined,
    pdfPreviewUrl: () => null,
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
    sendMagicLink: async (email: string, inviteToken?: string) => {
      if (!firebaseConfigured()) {
        flash("Firebase isn't configured on this deploy yet.", "err");
        return;
      }
      const { auth } = getFirebase();
      const url = new URL("/auth/finish", window.location.origin);
      if (inviteToken) url.searchParams.set("invite", inviteToken);
      await sendSignInLinkToEmail(auth, email, { url: url.toString(), handleCodeInApp: true });
      window.localStorage.setItem("tpk-email", email);
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
      attachPdf: async (sessionId, file) => {
        const problem = validatePdf(file);
        if (problem) {
          flash(problem, "err");
          return;
        }
        const current = stateRef.current?.sessions.find((s) => s.id === sessionId);
        if (!current) return;
        const path = nestedRecapPath(current.cid, current.id, file.name);
        try {
          const { storage } = getFirebase();
          const { ref, uploadBytes } = await import("firebase/storage");
          await uploadBytes(ref(storage, path), file, { contentType: "application/pdf" });
          const next = applyLocal((s) => saveRecap(s, sessionId, { pdfPath: path, pdfName: file.name, pdfUrl: null }));
          const session = next?.sessions.find((s) => s.id === sessionId);
          if (session) await persistSession(session);
          const campaign = next?.campaigns.find((c) => c.id === current.cid);
          if (campaign) {
            const { db } = getFirebase();
            await setDoc(doc(db, "campaigns", campaign.id), {
              previouslyOn: campaign.previouslyOn ?? null,
              previouslyOnSessionId: campaign.previouslyOnSessionId ?? null,
            }, { merge: true });
          }
          flash("PDF saved for the campaign.");
        } catch {
          flash("Couldn't upload that PDF.", "err");
        }
      },
      clearPdf: (sessionId) => {
        const before = stateRef.current?.sessions.find((s) => s.id === sessionId);
        const next = applyLocal((s) => saveRecap(s, sessionId, { pdfPath: null }));
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
      pdfPreviewUrl: () => null,
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
        void fetch(`/api/campaigns/${cid}/transfer`, { method: "POST", body: JSON.stringify({ uid }) });
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
            await setDoc(doc(db, "campaigns", created.id, "sessions", session.id), { ...session, attendance: attendanceMap(session.attendance) });
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
        flash("Locked in. It's a real play date now.");
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
        void fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cid, role, email }) })
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
        void fetch(`/api/invites/${token}/accept`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(me) })
          .then(async (res) => {
            if (!res.ok) flash("Couldn't accept that invite.", "err");
          });
        const local = acceptInviteModel(stateRef.current || state, token, { ...me, id: state.me.id });
        if (!("error" in local)) setState(local);
        return true;
      },
      sendMagicLink: signedOut.sendMagicLink,
    };
  }, [state, authUser, signedOut, flash, persistSession]);

  useEffect(() => {
    if (!firebaseConfigured() || !authUser) return;
    if (!isSignInWithEmailLink(getFirebase().auth, window.location.href)) return;
    const email = window.localStorage.getItem("tpk-email");
    if (!email) return;
    void signInWithEmailLink(getFirebase().auth, email, window.location.href).catch((err) => {
      flash(err instanceof Error ? err.message : "That sign-in link didn't work.", "err");
    });
  }, [authUser, flash]);

  return <StoreContext.Provider value={api ?? signedOut}>{children}</StoreContext.Provider>;
}
