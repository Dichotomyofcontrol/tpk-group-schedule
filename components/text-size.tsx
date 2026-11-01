"use client";

import { useEffect, useState } from "react";

const KEY = "tpk-text";

/** A / A+ toggle. Pinch zoom is off in the viewport, so this is the way to get bigger type. */
export function TextSize() {
  const [big, setBig] = useState(false);
  useEffect(() => { setBig(document.documentElement.classList.contains("txl")); }, []);
  const set = (next: boolean) => {
    setBig(next);
    document.documentElement.classList.toggle("txl", next);
    try { localStorage.setItem(KEY, next ? "lg" : "md"); } catch { /* private mode */ }
  };
  return (
    <div className="txt-size" role="group" aria-label="Text size">
      <button type="button" aria-pressed={!big} onClick={() => set(false)}>A</button>
      <button type="button" aria-pressed={big} onClick={() => set(true)} aria-label="Larger text">A+</button>
    </div>
  );
}
