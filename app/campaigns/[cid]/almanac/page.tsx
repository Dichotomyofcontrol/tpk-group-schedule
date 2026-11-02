import { routeParam } from "@/lib/route-param";
import { CampaignAlmanac } from "@/components/almanac-view";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ cid: string }> }) {
  const raw = await params;
  const { cid } = { cid: routeParam(raw.cid) };
  return (
    <Shell>
      <CampaignAlmanac cid={cid} />
    </Shell>
  );
}
