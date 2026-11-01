import type { CapacitorConfig } from "@capacitor/cli";

// Taverning iOS. The shell loads the live site so server routes, auth and API
// keep working; native plugins (push, haptics, status bar, deep links) are
// injected by the Capacitor bridge and driven from components/native-bridge.tsx.
// native-shell/ is only the offline/first-launch fallback.
const config: CapacitorConfig = {
  appId: process.env.TAVERNING_BUNDLE_ID || "com.taverning.app",
  appName: "Taverning",
  webDir: "native-shell",
  server: {
    url: process.env.CAP_SERVER_URL || "https://taverning.com/sessions",
    allowNavigation: ["taverning.com", "www.taverning.com", "*.firebaseapp.com", "accounts.google.com"],
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#0b0a0c",
    preferredContentMode: "mobile",
    appendUserAgent: "TaverningApp/1",
    scrollEnabled: true,
    allowsLinkPreview: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: "#0b0a0c", showSpinner: false },
    StatusBar: { style: "DARK", overlaysWebView: true },
    Keyboard: { resize: "native", resizeOnFullScreen: true },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
