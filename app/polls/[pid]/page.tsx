import { PollView } from "@/components/poll-view";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  return <Shell><PollView pollId={pid} /></Shell>;
}
