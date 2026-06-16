import type { SummarizerResult } from "./summarizerClient";
import { normalizeArticleBody } from "../extract/normalizeArticleBody";
import { isBoilerplateLine, cleanKeyFacts, cleanSummaryText } from "./summaryQuality";

const FACT_LINE = /^[-*•]\s*(.+)$/;
const NUMBERED_FACT = /^\d+[.)]\s+(.+)$/;

export function parseSummarizerOutput(raw: string): SummarizerResult {
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const keyFacts: string[] = [];
  const entities: string[] = [];
  const keywords: string[] = [];
  const summaryParts: string[] = [];
  let titleEn = "";

  for (const line of lines) {
    const titleEnInline = line.match(/^title_en:?\s*(.+)$/i);
    if (titleEnInline?.[1]) {
      titleEn = titleEnInline[1].trim();
      continue;
    }

    const summaryInline = line.match(/^summary:?\s*(.+)$/i);
    if (summaryInline?.[1]) {
      summaryParts.push(summaryInline[1].trim());
      continue;
    }

    const fact = line.match(FACT_LINE) ?? line.match(NUMBERED_FACT);
    if (fact) {
      const text = fact[1].trim();
      if (!isBoilerplateLine(text)) keyFacts.push(text);
      continue;
    }

    if (/^facts?:?\s*$/i.test(line)) continue;

    if (/^entities?:/i.test(line)) {
      entities.push(
        ...line
          .replace(/^entities?:\s*/i, "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      continue;
    }

    if (/^keywords?:/i.test(line)) {
      keywords.push(
        ...line
          .replace(/^keywords?:\s*/i, "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      continue;
    }

    if (!isBoilerplateLine(line) && line.length > 20) {
      summaryParts.push(line);
    }
  }

  let summary = cleanSummaryText(summaryParts.join(" ")).slice(0, 400);
  const facts = cleanKeyFacts(keyFacts);

  if ((!summary || summary.length < 30) && facts.length) {
    summary = facts.slice(0, 3).join(". ") + ".";
  }
  if (!summary) summary = cleanSummaryText(raw).slice(0, 280);

  return {
    summary,
    titleEn: titleEn || undefined,
    keyFacts: facts.slice(0, 8),
    entities: entities.slice(0, 12),
    keywords: keywords.slice(0, 12),
  };
}

export function detectChineseText(text: string): boolean {
  const sample = text.slice(0, 1200);
  const cjk = (sample.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return cjk >= 8;
}

export function buildSummarizePrompt(articleText: string): string {
  const { body } = normalizeArticleBody(articleText);
  const clipped = body.slice(0, 3600);

  return `Read this news article (any language) and respond in English only for the user interface.

Use this exact format (no intro phrases):

TITLE_EN: Clear English headline (translate the original headline)

SUMMARY: 2-3 English sentences — what happened, who is involved, why it matters.

FACTS:
- First key fact in English
- Second key fact
- Third key fact

ENTITIES: Person or org names, comma-separated
KEYWORDS: 5-8 English topic words, comma-separated

Article:
${clipped}`;
}

export function buildTranslatePrompt(title: string, body: string): string {
  const clipped = body.slice(0, 1200);
  return `Translate this news headline and snippet to English for a news app UI.

Use exactly this format:

TITLE_EN: English headline
SUMMARY: 1-2 English sentences summarizing the snippet

Headline:
${title.trim()}

Snippet:
${clipped.trim()}`;
}

export function parseTranslateOutput(raw: string): { title: string; summary: string } {
  let title = "";
  let summary = "";
  for (const line of raw.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
    const t = line.match(/^title_en:?\s*(.+)$/i);
    if (t?.[1]) {
      title = cleanSummaryText(t[1]);
      continue;
    }
    const s = line.match(/^summary:?\s*(.+)$/i);
    if (s?.[1]) {
      summary = cleanSummaryText(s[1]);
    }
  }
  return { title, summary };
}

export function buildQueryExpansionPrompt(query: string): string {
  return `You expand news search queries into English synonyms and related news phrases.

Rules:
- Return ONLY a comma-separated list (8-16 terms). No sentences.
- Include synonyms, alternate phrases, and related entities for NEWS articles.
- For ambiguous words, use the most common NEWS meaning (e.g. "car" → automobile, vehicle, automotive, EV, truck — NOT care/card/carbon).
- Exclude generic words (news, report, world, company, market, today).
- Keep each term under 4 words.

Query: ${query}`;
}

export function parseExpansionOutput(raw: string): string[] {
  const line = raw
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 3 && !/^(keywords?|terms?|synonyms?):?\s*$/i.test(l));
  const blob = (line ?? raw).replace(/^keywords?:\s*/i, "");
  return blob
    .replace(/\n/g, ",")
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2 && s.length < 48)
    .slice(0, 16);
}
