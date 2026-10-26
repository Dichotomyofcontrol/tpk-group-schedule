import { stripHtml } from "./sanitize";
import type { Session } from "./types";

export const PDF_MAX_BYTES = 25 * 1024 * 1024;

export type RecapPatch = {
  recapHtml?: string;
  recapText?: string;
  recapMarkdown?: string;
  /** Null removes the PDF. Omit to leave it alone. */
  pdfPath?: string | null;
  pdfName?: string | null;
  pdfUrl?: string | null;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A small markdown subset: headings, emphasis, quotes, and lists. */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const inline = (value: string) => escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      close();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      close();
      const level = Math.min(Math.max(heading[1].length, 2), 3);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (trimmed.startsWith("> ")) {
      close();
      out.push(`<blockquote><p>${inline(trimmed.slice(2))}</p></blockquote>`);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (list !== "ul") {
        close();
        list = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (numbered) {
      if (list !== "ol") {
        close();
        list = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }
    close();
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  close();
  return out.join("");
}

/** First real paragraph of a recap, skipping a short "Recap by …" byline. */
export function openingParagraph(session: Pick<Session, "recapHtml" | "recapMarkdown" | "recapText">): string {
  const htmlParas = [...(session.recapHtml || "").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => stripHtml(match[1] || ""));
  const fromHtml = firstParagraph(htmlParas);
  if (fromHtml) return fromHtml;
  const fromMarkdown = firstParagraph(markdownBlocks(session.recapMarkdown || ""));
  if (fromMarkdown) return fromMarkdown;
  return firstParagraph([(session.recapText || "").trim()]) || "";
}

function markdownBlocks(markdown: string): string[] {
  return markdown.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed || /^#{1,6}\s/.test(trimmed)) return "";
    return stripHtml(markdownToHtml(trimmed));
  });
}

function isByline(text: string): boolean {
  return /^recap by\b/i.test(text) && text.length < 80;
}

function firstParagraph(parts: string[]): string {
  const clean = parts.map((part) => part.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim()).filter(Boolean);
  return clean.find((part) => !isByline(part) && part.length >= 40) || clean.find((part) => !isByline(part)) || "";
}

/** Spoken pace for a Previously on opener. About 150 words a minute. */
export function readAloudMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / 150)) : 0;
}

/**
 * The read-aloud for Up next. The session's stored opener wins.
 * Otherwise the campaign's stored opener. A recap heading is not an opener.
 */
export function storedReadAloud(
  session: { previouslyOn?: string } | null | undefined,
  campaign: { previouslyOn?: string } | null | undefined,
): string {
  return session?.previouslyOn?.trim() || campaign?.previouslyOn?.trim() || "";
}

export function excerpt(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function recapPlain(session: Pick<Session, "recapText" | "recapHtml" | "recapMarkdown">): string {
  return (session.recapText || stripHtml(session.recapHtml || "") || stripHtml(markdownToHtml(session.recapMarkdown || ""))).replace(/\s+/g, " ").trim();
}

export function hasRecap(session: Pick<Session, "recapText" | "recapHtml" | "recapMarkdown" | "pdfPath" | "pdfName">): boolean {
  return Boolean(session.recapText || session.recapHtml || session.recapMarkdown || session.pdfPath || session.pdfName);
}

/**
 * Turn a stored pdfUrl into a Storage object path.
 * `/recaps/file.pdf` and `recaps/file.pdf` stay as `recaps/file.pdf`.
 * Download-token URLs yield the object path only; the token is not returned.
 * Avatar objects under `recaps/avatars/` are not recap files.
 */
export function storagePathFromPdfUrl(pdfUrl: unknown): { path?: string; avatar?: boolean; tokenStripped?: boolean } {
  if (typeof pdfUrl !== "string" || !pdfUrl.trim()) return {};
  const raw = pdfUrl.trim();
  const tokenStripped = /[?&]token=/.test(raw);
  let path = "";
  if (raw.startsWith("/recaps/")) path = raw.slice(1).split("?")[0];
  else if (raw.startsWith("recaps/")) path = raw.split("?")[0];
  else {
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/o\/(.+)$/);
      if (match) path = decodeURIComponent(match[1]);
    } catch {
      return {};
    }
  }
  if (!path.startsWith("recaps/") || path.includes("..")) return {};
  if (path === "recaps/avatars" || path.startsWith("recaps/avatars/")) return { avatar: true, path, tokenStripped };
  return { path, tokenStripped };
}

/** Legacy uploads are one path segment: `recaps/{file}`. */
export function legacyRecapFileName(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "recaps" || parts[1] === "avatars") return null;
  return parts[1];
}

export function nestedRecapPath(cid: string, sid: string, filename: string): string {
  const base = filename.split(/[/\\]/).pop() || "recap.pdf";
  const clean = base.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "") || "recap.pdf";
  const name = clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
  return `recaps/${cid}/${sid}/${name}`;
}

export function validatePdf(file: { name: string; size: number; type: string }): string | null {
  const pdfType = !file.type || file.type === "application/pdf";
  const pdfName = file.name.toLowerCase().endsWith(".pdf");
  if (!pdfType || !pdfName) return "Recap files have to be PDFs.";
  if (file.size <= 0) return "That PDF is empty.";
  if (file.size > PDF_MAX_BYTES) return `Too big (${Math.round(file.size / 1048576)} MB). PDFs can be up to 25 MB.`;
  return null;
}

/** Best-effort page count from the PDF bytes. Returns undefined when unsure. */
export async function countPdfPages(file: Blob): Promise<number | undefined> {
  try {
    const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
    const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length || 0;
    if (pages > 0) return pages;
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((x) => Number(x[1]));
    const max = counts.length ? Math.max(...counts) : 0;
    return max > 0 ? max : undefined;
  } catch {
    return undefined;
  }
}
