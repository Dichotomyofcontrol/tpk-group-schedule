"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Icon } from "./ui";

export function SignInView() {
  const store = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="sw" id="content">
      <div className="sp-in">
        
        <h1>Sign in<span className="ghost-type">with email</span></h1>
        <p className="voice">We&apos;ll email a 6-digit code. Type it here, including from the Home Screen app. The link in the email still works in Safari.</p>
        {sent ? (
          <form className="card form inbox" onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true); setError("");
            try {
              await store.completeSignInCode(email, code);
              router.replace("/");
            } catch (err) {
              setError(err instanceof Error ? err.message : "That code didn't work. Check it, or request a new email.");
            } finally { setBusy(false); }
          }}>
            <span className="fi"><Icon name="mail" /></span>
            <h2>Check your inbox</h2>
            <p className="note">We sent a code to {email}. Type it here. You stay signed in on this device.</p>
            <label htmlFor="signin-code">6-digit code</label>
            <input
              id="signin-code"
              className="inp otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              enterKeyHint="go"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              aria-label="6-digit sign-in code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <button className="btn pri" type="submit" disabled={busy || code.length !== 6}>{busy ? "Signing in…" : "Sign in"}</button>
            {error && <p className="note ver" role="alert">{error}</p>}
            <button className="btn ghost" type="button" onClick={() => { setSent(false); setCode(""); setError(""); }}>Use a different email</button>
          </form>
        ) : (
          <form className="card form" onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true); setError("");
            try { await store.sendMagicLink(email); setSent(true); }
            catch (err) { setError(err instanceof Error ? err.message : "Couldn't send the sign-in email. Try again."); }
            finally { setBusy(false); }
          }}>
            <label htmlFor="email">Email</label>
            <input id="email" className="inp" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="btn pri" type="submit" disabled={busy}>{busy ? "Sending…" : <>Email me a sign-in code <Icon name="arrow" className="ic sm" /></>}</button>
            {error && <p className="note ver" role="alert">{error}</p>}
          </form>
        )}
        <ol className="steps">
          <li><b>01</b>We email a 6-digit code and a link.</li>
          <li><b>02</b>Type the code here. The link still opens Safari.</li>
        </ol>
      </div>
      <div className="sw-mark" aria-hidden="true"><span className="watermark">Taverning</span></div>
    </div>
  );
}
