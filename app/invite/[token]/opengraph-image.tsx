import { invitePreview } from "@/lib/invite-preview";
import { shareCard } from "../../opengraph-image";

export const alt = "You're invited to a table on Six in the TPK";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await invitePreview(token);
  if (!p) return shareCard("You're invited", "Pull up a chair at the table.", "Tap to see the campaign and say you're in.");
  const sub = [p.by ? `${p.by} invited you` : "You're invited", p.place].filter(Boolean).join(" · ");
  return shareCard("You're invited to", p.name, sub);
}
