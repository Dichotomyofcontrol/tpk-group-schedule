import type { Firestore } from "firebase-admin/firestore";
import { apnsConfig, deadToken, sendApns, type PushPayload, type Transport } from "./apns";

/** Pushes to every iOS device a user registered (users/{uid}/devices). No-op until the APNs key is configured. */
export async function pushToUsers(db: Firestore, uids: string[], payload: PushPayload, transport?: Transport): Promise<number> {
  const cfg = apnsConfig();
  if (!cfg || !uids.length) return 0;
  let delivered = 0;
  for (const uid of Array.from(new Set(uids))) {
    const devices = await db.collection("users").doc(uid).collection("devices").get();
    const tokens = devices.docs.map((d) => String(d.get("token") || "")).filter(Boolean);
    if (!tokens.length) continue;
    const results = await sendApns(tokens, payload, cfg, transport);
    delivered += results.filter((r) => r.status === 200).length;
    await Promise.all(results.filter(deadToken).map((r) => devices.docs.find((d) => d.get("token") === r.token)?.ref.delete()));
  }
  return delivered;
}
