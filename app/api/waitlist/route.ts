import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminConfigured, adminDb } from "@/lib/firebase-admin";
import { hit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: { email?: unknown; table?: unknown; website?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  // Honeypot: bots fill every field. Pretend it worked.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const table = typeof body.table === "string" ? body.table.trim().slice(0, 140) : "";
  if (!EMAIL.test(email) || email.length > 200) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  if (!adminConfigured()) return NextResponse.json({ error: "The list is closed right now. Try again later." }, { status: 503 });
  const db = adminDb();
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!(await hit(db, `waitlist:${ip}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many tries. Give it an hour." }, { status: 429 });
  }
  const id = email.replace(/[^a-z0-9]/g, "_").slice(0, 120);
  const ref = db.collection("waitlist").doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) tx.update(ref, { table: table || snap.get("table") || "", updatedAt: FieldValue.serverTimestamp(), count: FieldValue.increment(1) });
    else tx.set(ref, { email, table, source: "landing", env: process.env.VERCEL_ENV || "local", createdAt: FieldValue.serverTimestamp(), count: 1 });
  });
  return NextResponse.json({ ok: true });
}
