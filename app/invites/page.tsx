import { InvitesView } from "@/components/invites-view";
import { Shell } from "@/components/shell";

export default async function Page({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const { campaign } = await searchParams;
  return <Shell><InvitesView initialCampaign={campaign} /></Shell>;
}
