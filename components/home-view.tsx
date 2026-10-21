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
    if (state.me.id) router.replace(`/sessions${window.location.search}`);
  }, [state.me.id, router]);
  if (state.me.id) return null;
  return <Landing />;
}
