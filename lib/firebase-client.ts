import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export type FirebaseClient = { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage };

let client: FirebaseClient | null = null;

export function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

export function firebaseConfigured(): boolean {
  const cfg = firebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId);
}

/** iOS Home Screen apps have their own storage, and IndexedDB there often fails open so Firebase keeps the session in memory. */
export function standaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

function createAuth(app: FirebaseApp): Auth {
  // Standalone prefers localStorage, which survives leaving the Home Screen app. Browser tabs keep IndexedDB first.
  const persistence = standaloneDisplay()
    ? [browserLocalPersistence, indexedDBLocalPersistence]
    : [indexedDBLocalPersistence, browserLocalPersistence];
  try {
    return initializeAuth(app, { persistence });
  } catch (error) {
    if ((error as { code?: string }).code === "auth/already-initialized") return getAuth(app);
    return getAuth(app);
  }
}

export function getFirebase(): FirebaseClient {
  if (client) return client;
  const cfg = firebaseConfig();
  if (!cfg.apiKey || !cfg.projectId) throw new Error("Firebase config is missing.");
  const app = getApps()[0] ?? initializeApp(cfg);
  const auth = createAuth(app);
  if (standaloneDisplay()) void navigator.storage?.persist?.();
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  client = { app, auth, db, storage: getStorage(app) };
  return client;
}
