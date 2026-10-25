import type { Metadata } from "next";
import { invitePreview } from "@/lib/invite-preview";
import { InviteGuest } from "@/components/invite-guest";
import { Shell } from "@/components/shell";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const p = await invitePreview(token);
  const title = p ? `Join ${p.name} · ${SITE_NAME}` : `You're invited · ${SITE_NAME}`;
  const description = p ? `${p.by ? `${p.by} invited you to ${p.name}` : `You're invited to ${p.name}`}. See the sessions and say you're in.` : "Pull up a chair at the table. See the campaign and say you're in.";
  return { title, description, openGraph: { title, description }, robots: { index: false } };
}


export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Shell><InviteGuest token={token} /></Shell>;
}
