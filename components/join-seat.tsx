"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { firebaseConfigured, getFirebase } from "@/lib/firebase-client";
import { seatMessage } from "@/lib/roster";

type Preview = {
  cid: string;
  campaignName: string;
  name: string;
  characterName?: string;
  status: "invited" | "joined";
  claimed: boolean;
  mine: boolean;
};

export function JoinSeat({ token }: { token: string }) {
  const store = useStore();
  const [seat, setSeat] = useState<Preview | null | "missing" | "loading">("loading");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"created" | "linked" | "already" | null>(null);

  useEffect(() => {
    let alive = true;
    const headers = new Headers();
    if (store.state.me.id) headers.set("x-demo-persona", store.state.me.id);
    // On the live site the preview needs the signed-in user's ID token, so "mine" is right.
    const bearer = store.mode === "live" && firebaseConfigured()
      ? Promise.resolve(getFirebase().auth.currentUser?.getIdToken().catch(() => "") ?? "")
      : Promise.resolve("");
    bearer.then((idToken) => {
      if (idToken) headers.set("authorization", `Bearer ${idToken}`);
      return fetch(`/api/join/${encodeURIComponent(token)}`, { headers, cache: "no-store" });
    })
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) { setSeat("missing"); return; }
        setSeat(await res.json() as Preview);
      })
      .catch(() => { if (alive) setSeat("missing"); });
    return () => { alive = false; };
  }, [token, store.state.me.id, store.mode]);

  if (seat === "loading") return <div className="center-narrow"><p className="note">Opening your seat…</p></div>;
  if (seat === "missing" || !seat) {
    return (
      <div className="center-narrow">
        <div className="card empty-card">
          <h1 className="lt">This seat isn&apos;t open</h1>
          <p className="note">Ask the organizer for a fresh link.</p>
          <Link className="btn pri" href={store.signedIn ? "/sessions" : "/signin"}>{store.signedIn ? "Go to Sessions" : "Sign in"}</Link>
        </div>
      </div>
    );
  }

  const who = seat.characterName && seat.characterName !== seat.name ? `${seat.name} · ${seat.characterName}` : seat.name;

  return (
    <article className="card inv join-seat">
      <div className="ib">
        <div className="eyebrow">{seat.campaignName}</div>
        <h1>Your seat is {seat.name}</h1>
        <p>{who === seat.name ? `Claim this seat at ${seat.campaignName}.` : `${who}. Claim it at ${seat.campaignName}.`}</p>
        <p className="note">{seatMessage(seat, store.signedIn)}</p>
        {done && (
          <p className="gvoted" role="status">
            {done === "created" && `You're in as ${seat.name}.`}
            {done === "linked" && "Linked. You were already at the table, and this seat is yours."}
            {done === "already" && "This seat is already yours."}
          </p>
        )}
        {done && <Link className="btn pri" href={`/campaigns/${seat.cid}`}>Open the campaign</Link>}
        {!done && store.signedIn && (
          <button className="btn pri" type="button" disabled={busy || (seat.claimed && !seat.mine)} onClick={async () => {
            setBusy(true);
            setError("");
            const result = await store.claimSeat(token);
            setBusy(false);
            if (!result.ok) { setError(result.error); return; }
            setSeat({ ...seat, status: "joined", claimed: true, mine: true });
            setDone(result.already ? "already" : result.linked ? "linked" : "created");
          }}>{busy ? "Claiming…" : seat.mine ? "This seat is yours" : "Claim this seat"}</button>
        )}
        {!done && !store.signedIn && (
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            window.sessionStorage.setItem("tpk-join-seat", token);
            try { await store.sendMagicLink(email, undefined, token); setSent(true); } finally { setBusy(false); }
          }}>
            <div className="fld"><label htmlFor="je">Email</label><input id="je" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" /></div>
            <button className="btn pri" type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            {sent && <p className="note">Check your email. The link brings you back to this seat.</p>}
          </form>
        )}
        {error && <p className="guest-err" role="alert">{error}</p>}
      </div>
    </article>
  );
}
