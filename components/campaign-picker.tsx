"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Campaign } from "@/lib/types";
import { Icon } from "./ui";

/** "Campaign: All ▾" — plain text with a line chevron. Opens a popover (desktop) or bottom sheet (phone). */
export function CampaignPicker({ campaigns, value, onChange }: { campaigns: Campaign[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const options = [{ id: "all", name: "All", color: "" }, ...campaigns.map((c) => ({ id: c.id, name: c.name, color: c.color }))];
  const current = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[role=menuitemradio]") || []);
    (items().find((b) => b.getAttribute("aria-checked") === "true") || items()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); return; }
      if (e.key === "Tab") { setOpen(false); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const all = items();
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      const n = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
      all[n]?.focus();
    };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); btn.current?.focus(); };

  return (
    <div className="cpick" ref={wrap}>
      <button ref={btn} type="button" className="cpick-btn" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="cpl">Campaign:</span>
        {current.color && <i className="dot" style={{ background: current.color }} />}
        <span className="cpv">{current.name}</span>
        <Icon name="chev" className="ic sm cpc" />
      </button>
      {open && (
        <>
          <div className="cpick-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="cpick-pop" role="presentation">
            <div className="cpick-h" aria-hidden="true">Campaign</div>
            <ul ref={list} id={id} role="menu" aria-label="Filter by campaign">
              {options.map((o) => (
                <li key={o.id} role="none">
                  <button type="button" role="menuitemradio" aria-checked={o.id === current.id} onClick={() => pick(o.id)}>
                    <i className="dot" style={{ background: o.color || "transparent", boxShadow: o.color ? undefined : "inset 0 0 0 1px var(--ink3)" }} />
                    <span className="cpn">{o.name}</span>
                    {o.id === current.id && <Icon name="check" className="ic sm cpk" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
