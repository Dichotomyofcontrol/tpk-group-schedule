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
  const started = useRef(false);

  const finishLive = async (given?: string) => {
    setMessage("Finishing the email link…");
    setNeedEmail(false);
    try {
      const result = await store.finishMagicLink(given);
      if (result === "need-email") {
        setNeedEmail(true);
        setMessage("Confirm the email this link was sent to.");
        return;
      }
      if (result === "not-link") {
        setMessage("Open the link from your email to finish signing in.");
        return;
      }
      const token = params.get("invite");
      router.replace(token ? `/invite/${token}` : "/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That sign-in link didn't work. Request a new one.");
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
        <h1>Sign in</h1>
        <p>{message}</p>
        {needEmail && (
          <form onSubmit={(event) => { event.preventDefault(); void finishLive(email); }}>
            <div className="field">
              <label htmlFor="confirm-email">Email</label>
              <input id="confirm-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            <button className="b p" type="submit">Finish sign-in</button>
          </form>
        )}
        <p><Link href="/signin">Send a new link</Link></p>
      </div>
    </div>
  );
}
