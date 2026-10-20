import { serveCalendar } from "@/lib/serve-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const hide = (new URL(request.url).searchParams.get("hide") || "").split(",").filter(Boolean);
  return serveCalendar(token, undefined, hide);
}
