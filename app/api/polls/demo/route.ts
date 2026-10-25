import { adminConfigured } from "@/lib/firebase-admin";
import { parseDemoRegistration, rememberDemoPoll } from "@/lib/poll-demo";
import { hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Remembers a poll created in the local demo so its public link can accept votes. Disabled once Firebase Admin is configured. */
export async function POST(request: Request) {
  if (adminConfigured()) return Response.json({ error: "Not found." }, { status: 404 });
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 100_000) return Response.json({ error: "That poll is too large." }, { status: 413 });
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || "unknown";
  if (!(await hit(null, `poll-demo:${ip}`, 30, 10 * 60 * 1000))) {
    return Response.json({ error: "Too many new polls from this network." }, { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send JSON." }, { status: 400 }); }
  const parsed = parseDemoRegistration(body);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  rememberDemoPoll(parsed);
  return Response.json({ ok: true });
}
