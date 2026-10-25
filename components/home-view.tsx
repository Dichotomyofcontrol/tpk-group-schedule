"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Landing } from "./landing";

/** Signed out: the landing page. Signed in: Sessions lives at /sessions. */
export function HomeView() {
  const { state } = useStore();
  const router = useRouter();
  useEffect(() => {
    // ?as=guest is the signed-out fixture. Don't bounce to Sessions before that persona applies.
    if (new URLSearchParams(window.location.search).get("as") === "guest") return;
    if (state.me.id) router.replace(`/sessions${window.location.search}`);
  }, [state.me.id, router]);
  if (state.me.id) return null;
  return <Landing />;
}
