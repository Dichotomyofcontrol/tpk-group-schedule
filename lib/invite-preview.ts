import { adminConfigured, adminDb } from "./firebase-admin";

/** Public bits of an invite for link previews: campaign name, who invited, usual place. Null on any problem. */
export async function invitePreview(token: string): Promise<{ name: string; by: string; place: string } | null> {
  try {
    if (!adminConfigured() || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) return null;
    const snap = await adminDb().collection("invites").doc(token).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (data.status === "revoked") return null;
    const c = (await adminDb().collection("campaigns").doc(String(data.cid)).get()).data() || {};
    if (!c.name || c.status === "archived") return null;
    return { name: String(c.name).slice(0, 60), by: String(data.createdByName || "").slice(0, 40), place: String(c.defaultLocation || "").slice(0, 40) };
  } catch {
    return null;
  }
}
