import { InviteGuest } from "@/components/invite-guest";
import { Shell } from "@/components/shell";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Shell bare><InviteGuest token={token} /></Shell>;
}
