"use client";

import { useEffect, useState } from "react";
import { setRecorded, type RecordedPayload } from "@/lib/almanac-stats";
import { getFirebase } from "@/lib/firebase-client";
import { useStore } from "@/lib/store";

/**
 * Loads the recorded Almanac stats this viewer may see from the server
 * (members only). Returns a counter that changes when they arrive.
 */
export function useRecorded(): number {
  const { mode, state } = useStore();
  const viewer = state.me.id;
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setRecorded(null);
    setVersion((v) => v + 1);
    (async () => {
      const headers = new Headers();
      if (mode === "demo") headers.set("x-demo-persona", viewer);
      else {
        const user = getFirebase().auth.currentUser;
        const token = user ? await user.getIdToken().catch(() => "") : "";
        if (!token) return;
        headers.set("Authorization", `Bearer ${token}`);
      }
      const res = await fetch("/api/almanac/recorded", { headers, cache: "no-store" }).catch(() => null);
      if (!res?.ok || !live) return;
      const payload = (await res.json().catch(() => null)) as RecordedPayload | null;
      if (!live || !payload?.campaigns) return;
      setRecorded(payload);
      setVersion((v) => v + 1);
    })();
    return () => {
      live = false;
    };
  }, [mode, viewer]);
  return version;
}
