"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { DemoProvider } from "@/lib/demo-provider";

export function Providers({ children, allowFixture = false }: { children: ReactNode; allowFixture?: boolean }) {
  const builtLive = process.env.NEXT_PUBLIC_DATA_MODE === "live";
  const [choice, setChoice] = useState<"demo" | "live">(builtLive ? "live" : "demo");
  const [Live, setLive] = useState<ComponentType<{ children: ReactNode }> | null>(null);
  // Offline: a small service worker keeps the app shell openable without a connection (production only).
  useEffect(() => {
    if (!builtLive || allowFixture || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, [builtLive, allowFixture]);
  useEffect(() => {
    if (!builtLive) return;
    const requested = new URLSearchParams(window.location.search).get("as");
    if (allowFixture && requested) window.sessionStorage.setItem("tpk-fixture", requested);
    const fixture = allowFixture && (requested || window.sessionStorage.getItem("tpk-fixture"));
    if (fixture) {
      setChoice("demo");
      return;
    }
    setChoice("live");
    void import("@/lib/firebase-provider").then((mod) => setLive(() => mod.FirebaseProvider));
  }, [builtLive, allowFixture]);
  if (!builtLive || choice === "demo") return <DemoProvider>{children}</DemoProvider>;
  if (!Live) return null;
  return <Live>{children}</Live>;
}
