"use client";

import { useEffect, useState } from "react";
import { appleSignInAvailable, signInWithAppleNative } from "@/lib/apple-sign-in";

/** Shown only inside the iOS app. Follows Apple's button guidelines (system label, Apple logo, full width). */
export function AppleSignInButton({ onDone }: { onDone?: () => void }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void appleSignInAvailable().then(setShow); }, []);
  if (!show) return null;
  return (
    <div className="apple-si">
      <button type="button" className="btn apple" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { if ((await signInWithAppleNative()) === "ok") onDone?.(); }
        catch (err) { setError(err instanceof Error ? err.message : "Sign in with Apple didn't finish."); }
        finally { setBusy(false); }
      }}>
        <svg aria-hidden="true" viewBox="0 0 17 20" width="15" height="18"><path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.3zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>
        {busy ? "Signing in…" : "Sign in with Apple"}
      </button>
      {error && <p className="note ver" role="alert">{error}</p>}
      <p className="or" aria-hidden="true"><span>or</span></p>
    </div>
  );
}
