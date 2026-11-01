"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), table: data.get("table"), website: data.get("website") }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "That didn't go through. Try again in a minute.");
      setState("done");
      setMsg("You're on the list. We'll write when a seat opens.");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "That didn't go through.");
    }
  }
  if (state === "done") return <p className="wl-done" role="status">{msg}</p>;
  return (
    <form className="wl" onSubmit={submit} noValidate={false}>
      <div className="fld">
        <label htmlFor="wl-email">Email</label>
        <input id="wl-email" name="email" type="email" autoComplete="email" required maxLength={200} />
      </div>
      <div className="fld">
        <label htmlFor="wl-table">What do you run? <span className="opt">Optional</span></label>
        <input id="wl-table" name="table" type="text" maxLength={140} placeholder="Weekly 5e, five players" />
      </div>
      <div className="hp" aria-hidden="true">
        <label htmlFor="wl-site">Website</label>
        <input id="wl-site" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn pri" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending" : "Request an invite"}</button>
      <p className="wl-msg" role="status" aria-live="polite">{state === "error" ? msg : ""}</p>
    </form>
  );
}
