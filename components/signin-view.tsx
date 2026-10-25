"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Icon } from "./ui";

export function SignInView() {
  const store = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="sw" id="content">
      <div className="sp-in">
        <p className="kicker">The door</p>
        <h1>Sign in<span className="ghost-type">with email</span></h1>
        <p className="voice">We&apos;ll send a one-tap link. No password, no Google account — and you only see the campaigns you&apos;re invited to.</p>
        {sent ? (
          <div className="card inbox">
            <span className="fi"><Icon name="mail" /></span>
            <h2>Check your inbox</h2>
            <p className="note">We sent a link to {email}. Open it on this device. It signs you in for 30 days.</p>
            <button className="btn ghost" type="button" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        ) : (
          <form className="card form" onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true); setError("");
            try { await store.sendMagicLink(email); setSent(true); }
            catch (err) { setError(err instanceof Error ? err.message : "Couldn't send the link. Try again."); }
            finally { setBusy(false); }
          }}>
            <label htmlFor="email">Email</label>
            <input id="email" className="inp" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="btn pri" type="submit" disabled={busy}>{busy ? "Sending…" : <>Email me a sign-in link <Icon name="arrow" className="ic sm" /></>}</button>
            {error && <p className="note ver" role="alert">{error}</p>}
          </form>
        )}
        <ol className="steps">
          <li><b>01</b>Open the email on this device.</li>
          <li><b>02</b>Tap the link — you&apos;re in for 30 days.</li>
        </ol>
      </div>
      <div className="sw-mark" aria-hidden="true"><span className="watermark">Six</span></div>
    </div>
  );
}
