import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function adminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIRESTORE_EMULATOR_HOST);
}

export function adminApp(): App {
  if (getApps().length) return getApps()[0]!;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tpk-group-8cdc8";
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as { project_id?: string; client_email: string; private_key: string };
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }),
      projectId: parsed.project_id || projectId,
    });
  }
  return initializeApp({ projectId });
}

export function adminDb(): Firestore {
  if (!adminConfigured()) throw new Error("Firebase Admin credentials are not configured.");
  return getFirestore(adminApp());
}

export async function verifyBearer(request: Request): Promise<{ uid: string; email?: string } | null> {
  if (!adminConfigured()) return null;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const decoded = await getAuth(adminApp()).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export function adminBucket() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStorage } = require("firebase-admin/storage") as typeof import("firebase-admin/storage");
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "";
  return getStorage(adminApp()).bucket(name || undefined);
}
