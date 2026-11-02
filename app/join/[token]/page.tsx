import { routeParam } from "@/lib/route-param";
import type { Metadata } from "next";
import { JoinSeat } from "@/components/join-seat";
import { Shell } from "@/components/shell";
import { previewSeat } from "@/lib/roster-server";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const raw = await params;
  const { token } = { token: routeParam(raw.token) };
  const seat = await previewSeat(token).catch(() => null);
  const title = seat ? `Your seat as ${seat.name} · ${seat.campaignName}` : `Claim your seat · ${SITE_NAME}`;
  const description = seat ? `Claim the ${seat.name} seat at ${seat.campaignName}.` : "Open your personal seat link to join the table.";
  return { title, description, openGraph: { title, description }, robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const raw = await params;
  const { token } = { token: routeParam(raw.token) };
  return <Shell><JoinSeat token={token} /></Shell>;
}
