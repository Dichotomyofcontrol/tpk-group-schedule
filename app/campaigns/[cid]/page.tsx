import { routeParam } from "@/lib/route-param";
import { CampaignView } from "@/components/campaign-view";
import { Shell } from "@/components/shell";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const raw = await params;
  const { cid } = { cid: routeParam(raw.cid) };
  const { welcome } = await searchParams;
  return (
    <Shell>
      <CampaignView cid={cid} welcome={welcome === "1"} />
    </Shell>
  );
}
