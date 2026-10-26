import { omitUndefined } from "./omit";
import type { Campaign } from "./types";

/**
 * Settings writes merge these fields only. `cover` is written by the cover
 * upload and remove paths. A full-document setDoc used to replace it.
 */
export function campaignPatchForMerge(patch: Partial<Campaign>): Record<string, unknown> {
  const rest = { ...patch } as Record<string, unknown>;
  delete rest.cover;
  delete rest.id;
  return omitUndefined(rest);
}

/** Cadence saves the schedule fields and leaves the uploaded cover alone. */
export function cadencePatchForMerge(campaign: Pick<Campaign, "cadence" | "defaultLocation" | "tz">): Record<string, unknown> {
  return omitUndefined({
    cadence: campaign.cadence,
    defaultLocation: campaign.defaultLocation,
    tz: campaign.tz,
  });
}

/** An <img> can paint https and data URLs after a refresh. blob: URLs cannot. */
export function durableCoverSrc(src: string | undefined | null): string {
  if (!src) return "";
  if (src.startsWith("https://") || src.startsWith("http://") || src.startsWith("data:")) return src;
  return "";
}

/**
 * Apply campaign-document writes the way Firestore does.
 * `replace` is a setDoc without merge (the old campaign save). `merge` keeps fields the write does not mention.
 */
export function applyCampaignDocWrites(
  initial: Record<string, unknown> | null,
  writes: Array<{ mode: "replace" | "merge"; data: Record<string, unknown> }>,
): Record<string, unknown> | null {
  let doc = initial;
  for (const write of writes) {
    if (write.mode === "replace" || !doc) doc = { ...write.data };
    else doc = { ...doc, ...write.data };
  }
  return doc;
}
