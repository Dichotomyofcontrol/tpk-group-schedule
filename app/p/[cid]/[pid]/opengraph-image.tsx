import { pollShareCopy, toPublicPoll } from "@/lib/poll-public";
import { loadPollRecord } from "@/lib/poll-record";
import { shareCard } from "../../../opengraph-image";

export const alt = "A date poll on Six in the TPK";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ cid: string; pid: string }> }) {
  const { cid, pid } = await params;
  const record = await loadPollRecord(cid, pid).catch(() => null);
  if (!record) return shareCard("Date poll", "Which night works?", "Pick every date that works. No account needed.");
  const view = await toPublicPoll(record, null);
  const copy = pollShareCopy(view);
  return shareCard(view.campaignName, view.title, copy.imageSub);
}
