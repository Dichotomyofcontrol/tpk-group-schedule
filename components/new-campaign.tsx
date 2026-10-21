"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Cadence } from "@/lib/types";
import { centerCrop } from "./cover-editor";
import { BackBar, Icon, SettingRow, Switch } from "./ui";

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
  const icon = "d20";
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
      <>
        <BackBar href="/campaigns" label="Campaigns" />
        <div className="card empty-card">
          <h1 className="lt">Invite-only for now</h1>
          <p className="note">Seth starts campaigns. Everyone else joins with an invite link.</p>
        </div>
      </>
    );
  }
  return (
    <div className="narrow">
    <BackBar href="/campaigns" label="Campaigns" />
    <h1 className="lt">New campaign</h1>
    <form className="card pad nform" onSubmit={async (e) => {
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
      if (!id) return;
      if (cover) {
        const blob = await centerCrop(cover);
        if (blob) await store.uploadCover(id, blob);
      }
      router.push(`/campaigns/${id}`);
    }}>
      <div className="fld"><label htmlFor="name">Name</label><input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Curse of Strahd" /></div>
      <div className="fld">
        <label htmlFor="cover-in">Cover <span className="note">optional</span></label>
        <label className="drop" htmlFor="cover-in">
          {preview ? <img src={preview} alt="" /> : <><Icon name="img" /><b>Add a cover image</b><span className="note">You can change it later</span></>}
        </label>
        <input id="cover-in" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCover(f); setPreview(URL.createObjectURL(f)); } }} />
      </div>
      <div className="fld">
        <span className="lbl">Color</span>
        <div className="colors">
          {PRESETS.map((preset) => (
            <button key={preset.color} type="button" className={color === preset.color ? "on" : ""} style={{ background: preset.color }} aria-label={preset.name} aria-pressed={color === preset.color} onClick={() => setColor(preset.color)} />
          ))}
        </div>
      </div>
      <div className="fld"><label htmlFor="place">Usual place</label><input id="place" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
      <div className="fld"><label htmlFor="tz">Time zone</label><input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} /></div>
      <SettingRow title="Usual night" detail="Sessions fill in on their own. You can skip or move one later.">
        <Switch on={series} label="Usual night" onChange={setSeries} />
      </SettingRow>
      {series && (
        <div className="frow">
          <div className="fld"><label htmlFor="ev">Every</label>
            <select id="ev" value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
              <option value={1}>Week</option>
              <option value={2}>Other week</option>
            </select>
          </div>
          <div className="fld"><label htmlFor="wd">On</label>
            <select id="wd" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => <option value={i} key={day}>{day}</option>)}
            </select>
          </div>
          <div className="fld"><label htmlFor="st">Starts</label><input id="st" type="time" value={startTime} onChange={(e) => setStart(e.target.value)} /></div>
        </div>
      )}
      <SettingRow title="Ask for RSVPs" detail="Off: everyone counts as in until they say otherwise.">
        <Switch on={requireRsvps} label="Ask for RSVPs" onChange={setRequire} />
      </SettingRow>
      <SettingRow title="Players can invite" detail="Anyone at the table can send an invite link.">
        <Switch on={allowMemberInvites} label="Players can invite" onChange={setInvites} />
      </SettingRow>
      <div className="two end"><button className="btn pri" type="submit">Create campaign</button></div>
    </form>
    </div>
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
