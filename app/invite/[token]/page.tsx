export const metadata = {
  title: "You're invited · Six in the TPK",
  description: "Pull up a chair at the table. See the campaign and say you're in.",
};

import { InviteGuest } from "@/components/invite-guest";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Shell><InviteGuest token={token} /></Shell>;
}
