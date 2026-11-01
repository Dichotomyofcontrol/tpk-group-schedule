"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useOptionalStore } from "@/lib/store";

/** The landing renders on the server. Once auth answers, signed-in people go to Sessions. */
export function HomeRedirect() {
  const store = useOptionalStore();
  const router = useRouter();
  const id = store?.state.me.id;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("as") === "guest") return;
    if (id) router.replace(`/sessions${window.location.search}`);
  }, [id, router]);
  return null;
}
