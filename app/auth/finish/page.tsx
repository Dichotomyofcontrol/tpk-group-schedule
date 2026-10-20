"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Finish() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const token = params.get("invite");
    if (store.mode === "demo") {
      const raw = window.sessionStorage.getItem("tpk-join");
      const join = raw ? JSON.parse(raw) as { email: string; name: string; token: string } : null;
      const inviteToken = token || join?.token;
      if (inviteToken) {
        const ok = store.acceptInvite(inviteToken, {
          id: store.state.me.id,
          email: join?.email || store.state.me.email,
          displayName: join?.name || store.state.me.displayName,
        });
        const invite = store.state.invites.find((i) => i.token === inviteToken);
        router.replace(ok && invite ? `/campaigns/${invite.cid}?welcome=1` : "/");
        return;
      }
      router.replace("/");
      return;
    }
    setMessage("Finishing the email link…");
  }, [params, router, store]);

  return <p style={{ padding: 24 }}>{message}</p>;
}
