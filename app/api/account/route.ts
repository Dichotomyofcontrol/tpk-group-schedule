import { getAuth } from "firebase-admin/auth";
import { adminBucket, adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";
import { bucketStore, deleteOwnAccount, planAccountDeletion } from "@/lib/delete-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** What deleting this signed-in account would do. The token is the only identity. */
export async function GET(request: Request) {
  if (!adminConfigured()) return json({ error: "Account deletion needs Firebase Admin." }, 503);
  const auth = await verifyBearer(request);
  if (!auth) return json({ error: "Sign in first." }, 401);
  const plan = await planAccountDeletion(adminDb(), auth.uid, (auth.email || "").toLowerCase());
  return json(plan);
}

/** Deletes the signed-in user only. A uid in the body is ignored. */
export async function DELETE(request: Request) {
  if (!adminConfigured()) return json({ error: "Account deletion needs Firebase Admin." }, 503);
  const auth = await verifyBearer(request);
  if (!auth) return json({ error: "Sign in first." }, 401);
  await request.json().catch(() => undefined);
  try {
    const result = await deleteOwnAccount(adminDb(), bucketStore(adminBucket()), auth.uid, (auth.email || "").toLowerCase());
    if (!result.ok) return json({ error: result.error, blocking: result.blocking || [] }, result.status);
    await getAuth().deleteUser(auth.uid);
    return json({ ok: true, deletedCampaigns: result.deletedCampaigns });
  } catch (error) {
    console.error("delete account failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Couldn't finish deleting the account. Sign-in was kept. Try again." }, 500);
  }
}
