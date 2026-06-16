import { cleanDisplayText, isReaderProxyDump, normalizeArticleBody } from "../extract/normalizeArticleBody";
import type { SummarizerResult } from "./summarizerClient";

const BOILERPLATE_LINE =
  /^(here is (the |a )?summar|this (article|news|is)|below is|the following|in summary|summarized version|provided news|as an ai|i cannot|let me know|\*+\s*summary)/i;

const BOILERPLATE_SUMMARY =
  /here is (the |a )?summar|summarized version|provided news article|\*+\s*summary|^\s*summary:\s*$/i;

const FAILED_PAGE_TITLES =
  /^(client challenge|just a moment|attention required|access denied|please enable javascript|403 forbidden|robot or human|are you a robot|security check|verify you are human)/i;

const FAILED_PAGE_BODY =
  /(cloudflare|cf-browser-verification|captcha|enable javascript|access denied|client challenge|bot detection|please turn on javascript)/i;

export function isBoilerplateLine(line: string): boolean {
  const l = line.trim();
  if (!l) return true;
  if (l.length < 12 && /^summary:?$/i.test(l)) return true;
  if (BOILERPLATE_LINE.test(l)) return true;
  if (/^\*+\s*$/.test(l)) return true;
  if (/^#{1,3}\s*summary/i.test(l)) return true;
  return false;
}

export function isBoilerplateSummary(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 25) return true;
  if (isReaderProxyDump(t)) return true;
  if (BOILERPLATE_SUMMARY.test(t)) return true;
  if (/^\*+/.test(t) && t.length < 80) return true;
  return false;
}

export function isFailedExtraction(title: string, text: string): boolean {
  const t = (title || "").trim();
  if (FAILED_PAGE_TITLES.test(t)) return true;
  const body = (text || "").trim();
  if (body.length < 100 && FAILED_PAGE_BODY.test(body)) return true;
  if (body.length < 40 && FAILED_PAGE_TITLES.test(body)) return true;
  return false;
}

export function cleanSummaryText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\*+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMeaningfulParagraph(text: string): string {
  const { body } = normalizeArticleBody(text);
  const blocks = body
    .split(/\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 35);
  for (const b of blocks) {
    if (!isBoilerplateLine(b) && !/^#{1,6}\s/.test(b) && !isReaderProxyDump(b)) {
      return cleanSummaryText(b);
    }
  }
  return cleanDisplayText(body, 280);
}

function stripHtmlish(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Best text to show users when model output is weak or empty */
export function pickDisplaySummary(
  summary: string,
  articleText: string,
  title: string,
  rssFallback = "",
  displaySummary = "",
): string {
  const DISPLAY_MAX = 280;

  const english = cleanDisplayText(displaySummary, DISPLAY_MAX);
  if (english.length >= 30 && !isBoilerplateSummary(english)) return english;

  const cleaned = cleanDisplayText(summary, DISPLAY_MAX);
  if (cleaned.length >= 40 && !isBoilerplateSummary(cleaned)) return cleaned;

  const fromRss = cleanDisplayText(stripHtmlish(rssFallback), DISPLAY_MAX);
  if (fromRss.length >= 40 && !isBoilerplateSummary(fromRss)) return fromRss;

  const fromArticle = firstMeaningfulParagraph(articleText);
  if (fromArticle.length >= 40 && !isBoilerplateSummary(fromArticle)) {
    return fromArticle.slice(0, DISPLAY_MAX);
  }

  if (cleaned.length > 0) return cleaned;
  return title.slice(0, 120);
}

export function pickDisplayTitle(
  title: string,
  articleText: string,
  summary: string,
  displayTitle = "",
): string {
  const english = cleanSummaryText(displayTitle);
  if (english.length > 12 && !isBoilerplateSummary(english)) return english.slice(0, 200);
  if (!isFailedExtraction(title, articleText)) return title;
  const fromSummary = cleanSummaryText(summary);
  if (fromSummary.length > 35 && !isBoilerplateSummary(fromSummary)) {
    const sentence = fromSummary.split(/[.!?]/)[0]?.trim();
    if (sentence && sentence.length > 20) return sentence.slice(0, 120);
  }
  const para = firstMeaningfulParagraph(articleText);
  if (para.length > 30 && !isBoilerplateSummary(para)) return para.slice(0, 120);
  if (/client challenge/i.test(title)) return "Story from paywalled source";
  return title;
}

export function hasDisplayableContent(article: {
  title: string;
  summary: string;
  articleText: string;
  displayTitle?: string;
  displaySummary?: string;
}): boolean {
  const text = pickDisplaySummary(
    article.summary,
    article.articleText,
    article.title,
    "",
    article.displaySummary ?? "",
  );
  return text.length >= 30 && !isBoilerplateSummary(text);
}

export function cleanKeyFacts(facts: string[]): string[] {
  return facts
    .map((f) => cleanSummaryText(f))
    .filter((f) => f.length > 12 && !isBoilerplateLine(f))
    .slice(0, 6);
}

export function normalizeSummarizerResult(
  result: SummarizerResult,
  rssDescription: string,
  articleText: string,
  title: string,
): SummarizerResult {
  const keyFacts = cleanKeyFacts(result.keyFacts);
  const summary = pickDisplaySummary(result.summary, articleText, title, rssDescription);

  if (isBoilerplateSummary(summary) && keyFacts.length) {
    return {
      ...result,
      summary: keyFacts.slice(0, 3).join(". ") + (keyFacts.length ? "." : ""),
      keyFacts,
    };
  }

  return {
    summary,
    keyFacts: keyFacts.length ? keyFacts : summary.length > 40 ? [summary.slice(0, 120)] : [],
    entities: result.entities.filter((e) => e.length > 1).slice(0, 12),
    keywords: result.keywords.filter((k) => k.length > 2).slice(0, 12),
  };
}
