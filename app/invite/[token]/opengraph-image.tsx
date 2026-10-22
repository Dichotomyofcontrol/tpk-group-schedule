import { shareCard } from "../../opengraph-image";

export const alt = "You're invited to a table on Six in the TPK";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return shareCard("You're invited", "Pull up a chair at the table.", "Tap to see the campaign and say you're in.");
}
