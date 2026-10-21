"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Finish() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [dead, setDead] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const finishLive = async (given?: string) => {
    setMessage("Finishing the email link…");
    setNeedEmail(false);
    try {
      const result = await store.finishMagicLink(given);
      if (result === "need-email") {
        setNeedEmail(true);
        setMessage("Opened the link in a different browser or app? Enter your email to finish signing in.");
        return;
      }
      if (result === "not-link") {
        setMessage("Open the link from your email to finish signing in.");
        return;
      }
      const token = params.get("invite");
      router.replace(token ? `/invite/${token}` : "/");
    } catch (error) {
      const code = (error as { code?: string })?.code || (error instanceof Error ? error.message : "");
      if (/invalid-email|user-mismatch/.test(code)) {
        // The stored or typed email doesn't match the one the link was sent to.
        try { window.localStorage.removeItem("tpk-email"); } catch { /* ignore */ }
        setNeedEmail(true);
        setMessage("That email doesn't match this link. Enter the email the link was sent to.");
        return;
      }
      if (/invalid-action-code|expired-action-code|argument-error/.test(code)) {
        setEmail((e) => e || (typeof window !== "undefined" ? window.localStorage.getItem("tpk-email") || "" : ""));
        setDead(true);
        setMessage("This sign-in link has expired or was already used. Links work once, and only the newest one works. Get a fresh link below.");
        return;
      }
      setEmail((e) => e || window.localStorage.getItem("tpk-email") || "");
      setDead(true);
      setMessage("That sign-in link didn't work. Get a fresh one below.");
    }
  };

  const resend = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      await store.sendMagicLink(email.trim(), params.get("invite") || undefined);
      setResent(true);
      setMessage(`We sent a new link to ${email.trim()}. Open the newest email.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't send a new link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("invite");
    if (store.mode === "demo" && params.get("demoLink") !== "1") {
      const raw = window.sessionStorage.getItem("tpk-join");
      const join = raw ? JSON.parse(raw) as { email: string; name: string; token: string } : null;
      const inviteToken = token || join?.token;
      if (inviteToken) {
        const ok = store.acceptInvite(inviteToken, {
          id: store.state.me.id,
          email: join?.email || store.state.me.email,
          displayName: join?.name || store.state.me.displayName,
        });
        const invite = store.state.invites.find((i) => i.token === inviteToken);
        router.replace(ok && invite ? `/campaigns/${invite.cid}?welcome=1` : "/");
        return;
      }
      router.replace("/");
      return;
    }
    void finishLive();
    // The email link is completed once, against the provider that mounted this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="center-narrow">
      <div className="gate">
        <h1>{dead ? "Link expired" : "Sign in"}</h1>
        <p role="status">{message}</p>
        {needEmail && (
          <form onSubmit={(event) => { event.preventDefault(); void finishLive(email.trim()); }}>
            <div className="field">
              <label htmlFor="confirm-email">Email</label>
              <input id="confirm-email" className="inp" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            <button className="btn pri" type="submit">Finish sign-in</button>
          </form>
        )}
        {dead && !resent && (
          <form onSubmit={(event) => { event.preventDefault(); void resend(); }}>
            <div className="field">
              <label htmlFor="resend-email">Email</label>
              <input id="resend-email" className="inp" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            <button className="btn pri" type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a new link"}</button>
          </form>
        )}
        {!dead && !needEmail && <p><Link href="/signin">Send a new link</Link></p>}
      </div>
    </div>
  );
}
