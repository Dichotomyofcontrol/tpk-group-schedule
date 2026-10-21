import { adminBucket, adminConfigured, adminDb, verifyBearer } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/** Short-lived signed URL for a recap PDF the caller can see. */
export async function POST(request: Request) {
  if (!adminConfigured()) return Response.json({ error: "Files need Firebase Admin." }, { status: 503 });
  const auth = await verifyBearer(request);
  if (!auth) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { cid?: string; sid?: string; path?: string; download?: boolean };
  const { cid, sid, path } = body;
  if (!cid || !sid || !path || typeof path !== "string" || !path.startsWith("recaps/") || path.includes("..")) {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const db = adminDb();
  const member = await db.doc(`campaigns/${cid}/members/${auth.uid}`).get();
  if (!member.exists) return Response.json({ error: "Not your table." }, { status: 403 });
  const session = await db.doc(`campaigns/${cid}/sessions/${sid}`).get();
  if (!session.exists) return Response.json({ error: "Session not found." }, { status: 404 });
  const data = session.data() || {};
  const files = Array.isArray(data.extraPdfs) ? data.extraPdfs as Array<{ path?: string; name?: string }> : [];
  const known = data.pdfPath === path || files.some((f) => f.path === path);
  if (!known) return Response.json({ error: "File not found." }, { status: 404 });
  const name = (files.find((f) => f.path === path)?.name || data.pdfName || "recap.pdf").replace(/["\\\r\n]/g, "");
  const [url] = await adminBucket().file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
    responseDisposition: `${body.download ? "attachment" : "inline"}; filename="${name}"`,
    responseType: "application/pdf",
  });
  return Response.json({ url });
}
