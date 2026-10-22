"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasUploadedCover } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { Campaign } from "@/lib/types";

/** Maps link for a place: Apple Maps on Apple devices, Google Maps elsewhere. */
export function useMapsHref(place: string) {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)), []);
  const q = encodeURIComponent(place);
  return apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const PATHS: Record<string, string> = {
  dates: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 12.2l2.3 2.3-2.3 2.3-2.3-2.3z"/>',
  camp: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V20"/><path d="M15.5 4.8v6l1.5-1.2 1.5 1.2V4.6"/>',
  polls: '<path d="M4 20h16"/><rect x="5" y="11" width="3.5" height="6" rx="1"/><rect x="10.25" y="6" width="3.5" height="11" rx="1"/><rect x="15.5" y="13" width="3.5" height="4" rx="1"/>',
  inv: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  doc: '<path d="M7 3.5h7l4.5 4.5v12.5H7z"/><path d="M14 3.5V8h4.5M9.5 13h6M9.5 16.5h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  quill: '<path d="M19.5 4.5C13 5 8 9.5 6.5 17.5M19.5 4.5c-.5 6.5-5 11-11 12.5M6.5 17.5L4.5 19.5"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/>',
  sparkle: '<path d="M12 3.5l1.8 6.7 6.7 1.8-6.7 1.8L12 20.5l-1.8-6.7-6.7-1.8 6.7-1.8z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  down: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  img: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  dots: '<circle cx="6" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18" cy="12" r="1.1"/>',
  ext: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H4.5V7H10"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />;
}

export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="#FBF8F2" stroke="#1D1915" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 9.5l6.2 10.7H9.8z" fill="#9E2F1F" />
      <path d="M16 2.5v7M27.7 9.25l-5.5 10.95M4.3 9.25l5.5 10.95M9.8 20.2L4.3 22.75M22.2 20.2l5.5 2.55M9.8 20.2L16 29.5l6.2-9.3M16 9.5L4.3 9.25M16 9.5l11.7-.25" fill="none" stroke="#1D1915" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" opacity=".85" />
      <text x="16" y="18.6" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="7" fontWeight="600" fill="#FBF8F2">6</text>
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <Mark />
      <span>Six <i>in the</i> TPK</span>
    </Link>
  );
}

const HUES = ["c1", "c2", "c3", "c4", "c5", "c6"];

export function hueClass(id: string): string {
  let n = 0;
  for (const ch of id) n += ch.charCodeAt(0);
  return HUES[n % HUES.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, id, out = false, className = "" }: { name: string; id: string; out?: boolean; className?: string }) {
  return <span className={`av ${hueClass(id)}${out ? " o" : ""} ${className}`.trim()}>{initials(name)}</span>;
}

export function Cover({ src, label, className = "" }: { src: string; label: string; className?: string }) {
  return (
    <div className={`cover ${className}`.trim()} role="img" aria-label={label}>
      <img className="art" src={src} alt="" />
    </div>
  );
}

export function DateBlock({ dow, day, mon }: { dow: string; day: string; mon?: string }) {
  return (
    <div className="dt">
      <span className="dw">{dow}</span>
      <span className="dn">{day}</span>
      {mon ? <span className="dm">{mon}</span> : null}
    </div>
  );
}

/** A 44px back control for every screen that is not a tab. Goes back in history when we came from inside the app. */
export function BackBar({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <a
      className="backbar"
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const internal = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin) && window.history.length > 1;
        if (internal && window.sessionStorage.getItem("tpk-nav") === "1") router.back();
        else router.push(href);
      }}
    >
      <Icon name="back" />
      <span>{label}</span>
    </a>
  );
}

/** Parchment panel with a fine double rule and a line-art d20. Shown until the organizer uploads a cover. */
export function DefaultCover({ className = "" }: { className?: string }) {
  return (
    <div className={`dcover ${className}`.trim()} role="img" aria-label="Default cover">
      <svg className="dmark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 4l24 14v28L32 60 8 46V18z" />
        <path d="M32 18l12 21H20z" />
        <path d="M32 4v14M56 18L44 39M8 18l12 21M20 39L8 46M44 39l12 7M20 39l12 21 12-21M32 18L8 18M32 18h24" />
      </svg>
    </div>
  );
}

export function CampaignCover({ campaign, className = "" }: { campaign: Campaign; className?: string }) {
  const store = useStore();
  const path = campaign.cover?.path || "";
  const inline = !path && hasUploadedCover(campaign) ? campaign.cover.src : "";
  const [url, setUrl] = useState<string | null>(inline || null);
  useEffect(() => {
    let live = true;
    if (!path) { setUrl(inline || null); return; }
    void store.coverUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, inline]);
  if (!url) return <DefaultCover className={className} />;
  return (
    <div className={`ucover ${className}`.trim()}>
      <img src={url} alt="" />
    </div>
  );
}

export function Switch({ on, label, onChange, disabled = false }: { on: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" className={on ? "switch on" : "switch"} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export function SettingRow({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <div className="setrow">
      <div className="st"><b>{title}</b>{detail ? <span>{detail}</span> : null}</div>
      {children}
    </div>
  );
}

/** Placeholder shapes shown while the first sync is in flight. Hidden from screen readers; the live region says "Loading". */
export function Skeleton({ rows = 3, hero = true }: { rows?: number; hero?: boolean }) {
  return (
    <div className="skel" role="status" aria-label="Loading your table">
      {hero && <div className="card skel-hero" aria-hidden="true"><i className="sk sk-cover" /><div className="sk-body"><i className="sk sk-line w30" /><i className="sk sk-line w70 tall" /><i className="sk sk-line w50" /></div></div>}
      <div className="card list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skel-row"><i className="sk sk-date" /><div className="sk-body"><i className="sk sk-line w60" /><i className="sk sk-line w40" /></div></div>
        ))}
      </div>
    </div>
  );
}
