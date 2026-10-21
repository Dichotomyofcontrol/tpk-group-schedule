"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { hasUploadedCover } from "@/lib/model";
import type { Campaign } from "@/lib/types";
import { Icon } from "./ui";

const OUT_W = 1600;
const OUT_H = 900;

/** Pick an image, drag and zoom it inside a 16:9 frame, save a 1600×900 JPEG. Organizer only. */
export function CoverEditor({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const store = useStore();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => { input.current?.click(); }, []);

  const load = (file: File) => {
    setError(null);
    if (!/^image\/(jpeg|png|webp|heic|heif|gif)$/.test(file.type)) { setError("Pick a JPG, PNG or WebP image."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("That image is over 15 MB."); return; }
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { setImg(el); setZoom(1); setPos({ x: 0.5, y: 0.5 }); };
    el.onerror = () => setError("Couldn't read that image.");
    el.src = url;
  };

  // Geometry: the image covers the frame at zoom 1; pos is the focal point (0..1).
  const geometry = (fw: number, fh: number) => {
    if (!img) return null;
    const scale = Math.max(fw / img.width, fh / img.height) * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    const left = Math.min(0, Math.max(fw - w, fw / 2 - pos.x * w));
    const top = Math.min(0, Math.max(fh - h, fh / 2 - pos.y * h));
    return { w, h, left, top };
  };
  // Work in a fixed 1600x900 space and render as percentages, so layout timing never matters.
  const g = geometry(1600, 900);

  const save = async () => {
    if (!img) return;
    const gg = geometry(OUT_W, OUT_H);
    if (!gg) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, gg.left, gg.top, gg.w, gg.h);
    setBusy(true);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    const ok = blob ? await store.uploadCover(campaign.id, blob) : false;
    setBusy(false);
    if (ok) onClose();
    else setError("Couldn't save the cover. Try again.");
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cov-h">
      <button className="modal-scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="card sheet wide">
        <h2 id="cov-h">Campaign cover</h2>
        <p className="note">Shown on Sessions and the campaign page. Only you can change it.</p>
        <div
          ref={frame}
          className={img ? "crop" : "crop drop"}
          onPointerDown={(e) => { if (!img) { input.current?.click(); return; } (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
          onPointerMove={(e) => {
            if (!drag.current || !g) return;
            const k = 1600 / (frame.current?.clientWidth || 1600);
            const dx = ((e.clientX - drag.current.x) * k) / g.w;
            const dy = ((e.clientY - drag.current.y) * k) / g.h;
            setPos({ x: Math.min(1, Math.max(0, drag.current.px - dx)), y: Math.min(1, Math.max(0, drag.current.py - dy)) });
          }}
          onPointerUp={() => { drag.current = null; }}
        >
          {img && g ? (
            <img src={img.src} alt="" draggable={false} style={{ width: `${g.w / 16}%`, height: `${g.h / 9}%`, left: `${g.left / 16}%`, top: `${g.top / 9}%` }} />
          ) : (
            <span className="dropin"><Icon name="img" /><b>Choose an image</b><span className="note">JPG, PNG or WebP</span></span>
          )}
          <span className="ratio">16 : 9</span>
        </div>
        {img && (
          <label className="zoom">
            <span className="note">Zoom</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
          </label>
        )}
        {img && <p className="note">Drag to reposition.</p>}
        {error && <p className="note ver" role="alert">{error}</p>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) load(f); }} />
        <div className="two end">
          {hasUploadedCover(campaign) && !img && <button type="button" className="btn ghost sm ver" onClick={() => { store.removeCover(campaign.id); onClose(); }}>Remove cover</button>}
          <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
          {img && <button type="button" className="btn sec sm" onClick={() => input.current?.click()}>Choose another</button>}
          <button type="button" className="btn pri sm" disabled={!img || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save cover"}</button>
        </div>
      </div>
    </div>
  );
}

/** Centre-crop an image file to a 1600×900 JPEG. Used when a cover is picked while creating a campaign. */
export async function centerCrop(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.max(OUT_W / img.width, OUT_H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    canvas.getContext("2d")?.drawImage(img, (OUT_W - w) / 2, (OUT_H - h) / 2, w, h);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
