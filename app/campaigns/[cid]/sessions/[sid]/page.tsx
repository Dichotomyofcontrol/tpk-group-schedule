import { routeParam } from "@/lib/route-param";
import { SessionView } from "@/components/session-view";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ cid: string; sid: string }> }) {
  const raw = await params;
  const { cid, sid } = { cid: routeParam(raw.cid), sid: routeParam(raw.sid) };
  return (
    <Shell>
      <SessionView cid={cid} sid={sid} />
    </Shell>
  );
}
