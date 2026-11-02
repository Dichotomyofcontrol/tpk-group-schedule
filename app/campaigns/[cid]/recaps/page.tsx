import { routeParam } from "@/lib/route-param";
import { RecapHistory } from "@/components/recap-history";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ cid: string }> }) {
  const raw = await params;
  const { cid } = { cid: routeParam(raw.cid) };
  return (
    <Shell>
      <RecapHistory cid={cid} />
    </Shell>
  );
}
