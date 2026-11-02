import { routeParam } from "@/lib/route-param";
import { PollView } from "@/components/poll-view";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ pid: string }> }) {
  const raw = await params;
  const { pid } = { pid: routeParam(raw.pid) };
  return <Shell><PollView pollId={pid} /></Shell>;
}
