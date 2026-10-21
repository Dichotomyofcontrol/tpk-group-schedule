"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";

export function SignInView() {
  const store = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="center-narrow">
      <div className="gate">
        <Link href="/" className="logo"><i />Six in the TPK</Link>
        <h1>Sign in with email</h1>
        <p>No password and no Google account. We send a one-tap link. You only see campaigns you&apos;re invited to.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          await store.sendMagicLink(email);
          setSent(true);
        }}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="b p" type="submit" style={{ width: "100%" }}>Email me a sign-in link</button>
        </form>
        {sent && <p>Check {email}. The link brings you back to your play dates.</p>}
        {store.mode === "demo" && (
          <p className="tz">This preview is a sample table, so the link opens on this domain and signs you in here. On www.sixinthetpk.com the same button emails a Firebase link back to that site.</p>
        )}
      </div>
    </div>
  );
}
