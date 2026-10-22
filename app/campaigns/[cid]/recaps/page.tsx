import { RecapHistory } from "@/components/recap-history";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  return (
    <Shell>
      <RecapHistory cid={cid} />
    </Shell>
  );
}
