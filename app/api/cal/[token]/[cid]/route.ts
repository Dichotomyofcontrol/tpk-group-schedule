import { serveCalendar } from "@/lib/serve-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string; cid: string }> }) {
  const { token, cid } = await context.params;
  const hide = (new URL(request.url).searchParams.get("hide") || "").split(",").filter(Boolean);
  return serveCalendar(token, cid.replace(/\.ics$/, ""), hide);
}
