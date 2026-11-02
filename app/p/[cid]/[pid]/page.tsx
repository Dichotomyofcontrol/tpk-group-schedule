import { routeParam } from "@/lib/route-param";
import type { Metadata } from "next";
import { PublicPoll } from "@/components/public-poll";
import { Shell } from "@/components/shell";
import { pollShareCopy, toPublicPoll } from "@/lib/poll-public";
import { loadPollRecord } from "@/lib/poll-record";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ cid: string; pid: string }> }): Promise<Metadata> {
  const raw = await params;
  const { cid, pid } = { cid: routeParam(raw.cid), pid: routeParam(raw.pid) };
  const record = await loadPollRecord(cid, pid).catch(() => null);
  const fallback = {
    title: `Date poll · ${SITE_NAME}`,
    description: "Pick every date that works. No account needed.",
  };
  if (!record) return { ...fallback, robots: { index: false } };
  const view = await toPublicPoll(record, null);
  const copy = pollShareCopy(view);
  return {
    title: copy.title,
    description: copy.description,
    openGraph: { title: copy.title, description: copy.description },
    robots: { index: false },
  };
}

export default async function Page({ params }: { params: Promise<{ cid: string; pid: string }> }) {
  const raw = await params;
  const { cid, pid } = { cid: routeParam(raw.cid), pid: routeParam(raw.pid) };
  return <Shell><PublicPoll cid={cid} pid={pid} /></Shell>;
}
