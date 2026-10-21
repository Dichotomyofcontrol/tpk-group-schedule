"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Cadence } from "@/lib/types";

const PRESETS = [
  { name: "Strahd red", color: "#ef5350" },
  { name: "Frost blue", color: "#4fc3f7" },
  { name: "Draw Steel gold", color: "#f5c518" },
  { name: "Leyfarers green", color: "#4caf50" },
  { name: "Beerovia orange", color: "#ff9800" },
  { name: "One-shot violet", color: "#ce93d8" },
];

export function NewCampaign() {
  const store = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ef5350");
  const [icon, setIcon] = useState("d20");
  const [location, setLocation] = useState("TPK Brewing");
  const [tz, setTz] = useState("America/Los_Angeles");
  const [requireRsvps, setRequire] = useState(false);
  const [allowMemberInvites, setInvites] = useState(true);
  const [series, setSeries] = useState(true);
  const [weekday, setWeekday] = useState(5);
  const [interval, setInterval] = useState(2);
  const [startTime, setStart] = useState("18:30");
  if (!store.state.me.canCreateCampaigns) {
    return (
      <div className="card">
        <h1>The organizer list is closed</h1>
        <p>Seth can start campaigns. Everyone else joins with an invite. Opening this up later is a config change, not a rewrite.</p>
      </div>
    );
  }
  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault();
      const anchor = nextWeekday(weekday);
      const cadence: Cadence | null = series ? {
        id: "series",
        freq: "weeks",
        interval,
        weekday,
        startTime,
        durationMin: 240,
        tz,
        anchorDate: anchor,
        horizonMonths: 4,
        location,
      } : null;
      const id = store.createCampaign({ name, color, icon, tz, location, requireRsvps, allowMemberInvites, cadence });
      if (id) router.push(`/campaigns/${id}`);
    }}>
      <div className="mh"><h1>New campaign</h1></div>
      <div className="field"><label htmlFor="name">Name</label><input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Curse of Strahd" /></div>
      <div className="field">
        <label>Color</label>
        <div className="colors">
          {PRESETS.map((preset) => (
            <button key={preset.color} type="button" className={color === preset.color ? "on" : ""} style={{ background: preset.color }} aria-label={preset.name} aria-pressed={color === preset.color} onClick={() => setColor(preset.color)} />
          ))}
        </div>
      </div>
      <div className="field"><label htmlFor="icon">Icon</label><input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
      <div className="field"><label htmlFor="place">Usual place</label><input id="place" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
      <div className="field"><label htmlFor="tz">Time zone</label><input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} /></div>
      <div className="tog">
        <span><b>Repeating night</b><br /><span className="tz">Leave this on if you play on a cadence. You can skip or move a single date later.</span></span>
        <button type="button" className="switch" role="switch" aria-checked={series} onClick={() => setSeries((v) => !v)}><i /></button>
      </div>
      {series && (
        <>
          <div className="field">
            <label>Every</label>
            <select value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
              <option value={1}>week</option>
              <option value={2}>other week</option>
            </select>
          </div>
          <div className="field">
            <label>Weekday</label>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => <option value={i} key={day}>{day}</option>)}
            </select>
          </div>
          <div className="field"><label>Time</label><input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} /></div>
        </>
      )}
      <div className="tog">
        <span><b>Require RSVPs</b><br /><span className="tz">Leave this off. Everyone is assumed in, and a player taps Can&apos;t make it when they need to.</span></span>
        <button type="button" className="switch" role="switch" aria-checked={requireRsvps} aria-label="Require RSVPs" onClick={() => setRequire((v) => !v)}><i /></button>
      </div>
      <div className="tog">
        <span><b>Members can invite</b></span>
        <button type="button" className="switch" role="switch" aria-checked={allowMemberInvites} aria-label="Members can invite" onClick={() => setInvites((v) => !v)}><i /></button>
      </div>
      <button className="b p" type="submit">Create campaign</button>
    </form>
  );
}

function nextWeekday(weekday: number): string {
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    if (d.getUTCDay() === weekday) {
      return d.toISOString().slice(0, 10);
    }
  }
  return now.toISOString().slice(0, 10);
}
