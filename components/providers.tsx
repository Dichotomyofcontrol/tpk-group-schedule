"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { DemoProvider } from "@/lib/demo-provider";

export function Providers({ children }: { children: ReactNode }) {
  const live = process.env.NEXT_PUBLIC_DATA_MODE === "live";
  const [Live, setLive] = useState<ComponentType<{ children: ReactNode }> | null>(null);
  useEffect(() => {
    if (!live) return;
    void import("@/lib/firebase-provider").then((mod) => setLive(() => mod.FirebaseProvider));
  }, [live]);
  if (live) {
    if (!Live) return null;
    return <Live>{children}</Live>;
  }
  return <DemoProvider>{children}</DemoProvider>;
}
