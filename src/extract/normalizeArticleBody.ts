import { cleanSummaryText } from "../summarize/summaryQuality";

const READER_DUMP = /\b(url source|markdown content|published time):\s*/i;

/** True when text looks like a reader-proxy dump (Jina etc.), not a real summary. */
export function isReaderProxyDump(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (READER_DUMP.test(t)) return true;
  if (/^title:\s*.+\s+url source:/i.test(t.slice(0, 400))) return true;
  return false;
}

export type NormalizedArticleBody = {
  title?: string;
  body: string;
};

/** Strip Jina / reader-proxy wrappers and markdown noise before summarize or display. */
export function normalizeArticleBody(raw: string, fallbackTitle = ""): NormalizedArticleBody {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { body: "", title: fallbackTitle || undefined };

  if (/^title:\s*/im.test(text) && /markdown content:\s*/i.test(text)) {
    const titleMatch = text.match(/^title:\s*(.+)$/im);
    const afterMd = text.split(/markdown content:\s*/i)[1] ?? "";
    const body = stripMarkdownForIndex(afterMd.trim());
    return {
      title: titleMatch?.[1]?.trim() || fallbackTitle || undefined,
      body,
    };
  }

  if (isReaderProxyDump(text)) {
    text = text
      .replace(/^title:\s*.+$/gim, "")
      .replace(/^url source:\s*\S+\s*$/gim, "")
      .replace(/^published time:\s*.+$/gim, "")
      .replace(/markdown content:\s*/gi, "")
      .trim();
  }

  return { title: fallbackTitle || undefined, body: stripMarkdownForIndex(text) };
}

function stripMarkdownForIndex(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Clean text for UI cards — removes reader dumps and caps length. */
export function cleanDisplayText(text: string, maxLen = 280): string {
  if (!text.trim()) return "";
  if (isReaderProxyDump(text)) {
    const { body } = normalizeArticleBody(text);
    return cleanSummaryText(body).slice(0, maxLen);
  }
  return cleanSummaryText(text).slice(0, maxLen);
}
