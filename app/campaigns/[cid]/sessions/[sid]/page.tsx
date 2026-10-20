import { SessionView } from "@/components/session-view";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ cid: string; sid: string }> }) {
  const { cid, sid } = await params;
  return (
    <Shell>
      <SessionView cid={cid} sid={sid} />
    </Shell>
  );
}
