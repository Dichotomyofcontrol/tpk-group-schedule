import { CampaignAlmanac } from "@/components/almanac-view";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  return (
    <Shell>
      <CampaignAlmanac cid={cid} />
    </Shell>
  );
}
