"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Runs only inside the Taverning iOS app (Capacitor). On the web it is a no-op.
 * - routes universal links / notification taps in-app (no Safari bounce)
 * - registers for native push and sends the APNs token to /api/push/register
 * - light haptics on taps of buttons and links marked data-haptic
 * - hides the splash once the page is interactive; status bar follows the theme
 */
export function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    let cleanup: Array<() => void> = [];
    let cancelled = false;
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || cancelled) return;
      document.documentElement.classList.add("native-app");
      const [{ App }, { Haptics, ImpactStyle }, { SplashScreen }, { StatusBar, Style }, { PushNotifications }] = await Promise.all([
        import("@capacitor/app"), import("@capacitor/haptics"), import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"), import("@capacitor/push-notifications"),
      ]);

      const go = (raw: string) => {
        try {
          const u = new URL(raw, window.location.origin);
          if (/(^|\.)taverning\.com$/.test(u.hostname) || u.origin === window.location.origin) router.push(u.pathname + u.search + u.hash);
        } catch { /* ignore malformed links */ }
      };
      const open = await App.addListener("appUrlOpen", (e) => go(e.url));
      cleanup.push(() => void open.remove());

      const syncBar = () => {
        const night = document.documentElement.dataset.theme !== "cream";
        void StatusBar.setStyle({ style: night ? Style.Dark : Style.Light }).catch(() => undefined);
      };
      syncBar();
      const mo = new MutationObserver(syncBar);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      cleanup.push(() => mo.disconnect());
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined);

      const tap = (e: Event) => {
        const el = (e.target as HTMLElement | null)?.closest("button, [role=button], a[href], [data-haptic]");
        if (el?.closest(".tabs")) { void Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => undefined); return; }
        if (el) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
      };
      document.addEventListener("click", tap, { passive: true, capture: true });
      cleanup.push(() => document.removeEventListener("click", tap, true));

      const tapped = await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
        const url = (a.notification.data as { url?: string } | undefined)?.url;
        if (url) go(url);
      });
      cleanup.push(() => void tapped.remove());

      // Register the device once someone is signed in.
      const { firebaseConfigured, getFirebase } = await import("@/lib/firebase-client");
      if (!firebaseConfigured()) return;
      const { onAuthStateChanged } = await import("firebase/auth");
      const reg = await PushNotifications.addListener("registration", async ({ value }) => {
        const user = getFirebase().auth.currentUser;
        if (!user) return;
        const idToken = await user.getIdToken().catch(() => "");
        if (!idToken) return;
        void fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ token: value, platform: "ios" }),
        }).catch(() => undefined);
      });
      cleanup.push(() => void reg.remove());
      const unsub = onAuthStateChanged(getFirebase().auth, async (user) => {
        if (!user) return;
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") await PushNotifications.register();
      });
      cleanup.push(unsub);
    })();
    return () => { cancelled = true; cleanup.forEach((fn) => fn()); cleanup = []; };
  }, [router]);
  return null;
}
