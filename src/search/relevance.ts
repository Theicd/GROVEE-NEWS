import type { ArticleRecord, RssItem } from "../types";

export type RankedHit = {
  id: string;
  score: number;
  matchLabel: "high" | "medium" | "low";
};

export type RankOptions = {
  /** Synonyms / related phrases from Qwen query expansion */
  aiKeywords?: string[];
};

const TITLE_WORD = 55;
const TITLE_CONTAINS = 28;
const ENTITY = 48;
const KEYWORD = 32;
const SUMMARY = 20;
const KEY_FACT = 14;
const BODY_WORD = 8;
const BODY_CONTAINS = 3;

/** Static fallback aliases when the model is unavailable. */
const QUERY_ALIASES: Record<string, string[]> = {
  trump: ["trump", "donald trump"],
  ai: ["ai", "artificial intelligence", "machine learning", "llm"],
  war: ["war", "conflict", "military", "invasion"],
  ukraine: ["ukraine", "ukrainian", "kyiv", "zelensky"],
  israel: ["israel", "israeli", "gaza", "hamas", "tel aviv", "jerusalem", "idf", "netanyahu"],
  jpost: ["jpost", "jerusalem post", "israel", "israeli"],
  toi: ["times of israel", "israel", "israeli", "jerusalem"],
  ynet: ["ynet", "ynetnews", "israel", "israeli"],
  globes: ["globes", "israel", "tel aviv", "ta stock"],
  inn: ["israel national news", "channel 7", "inn", "israel", "israeli"],
  china: ["china", "chinese", "beijing"],
  energy: ["energy", "oil", "gas", "power"],
  space: ["space", "nasa", "rocket", "orbit", "mars"],
  tech: ["tech", "technology", "software", "startup"],
  car: ["car", "cars", "automobile", "automotive", "vehicle", "vehicles", "motor vehicle", "ev", "electric vehicle", "automaker", "truck", "suv"],
  cars: ["car", "cars", "automobile", "automotive", "vehicle", "vehicles", "motor vehicle", "ev", "automaker", "truck"],
  vehicle: ["vehicle", "vehicles", "car", "cars", "automobile", "automotive", "truck", "motor"],
  tcm: ["tcm", "traditional chinese medicine", "acupuncture", "herbal", "中医", "针灸", "中药", "推拿"],
  alternative: ["alternative", "holistic", "wellness", "herbal", "natural remedy", "ointment"],
  fashion: ["fashion", "vogue", "style", "runway", "designer"],
  health: ["health", "medical", "medicine", "clinical", "wellness"],
  github: ["github", "repository", "open source", "repo", "stars"],
  huggingface: ["huggingface", "hf hub", "model hub", "transformers", "diffusion", "llm model"],
  mythos: ["mythos", "anthropic", "claude"],
  claude: ["claude", "anthropic", "mythos", "opus"],
  anthropic: ["anthropic", "claude", "mythos"],
  opus: ["opus", "claude", "anthropic", "mythos"],
};

const GENERIC_EXPANSION_STOP = new Set([
  "news",
  "report",
  "reports",
  "story",
  "stories",
  "article",
  "articles",
  "world",
  "today",
  "latest",
  "update",
  "updates",
  "breaking",
  "said",
  "says",
  "new",
  "year",
  "people",
  "government",
  "company",
  "market",
  "business",
  "industry",
  "sector",
  "global",
  "international",
  "local",
  "major",
  "big",
  "top",
  "first",
  "last",
  "time",
  "week",
  "month",
  "day",
  "years",
]);

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "has",
  "was",
  "news",
  "about",
  "what",
  "how",
  "why",
  "from",
  "with",
]);

export function expandQueryKeywords(query: string): string[] {
  const base = query
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return [...new Set(base)];
}

export function sanitizeAiKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 2 && k.length < 48 && !GENERIC_EXPANSION_STOP.has(k)))];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Short tokens must use word boundaries — avoids "car" matching "care" / "carbon". */
export function textMatchesTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const hay = text.toLowerCase();
  const t = term.toLowerCase();
  if (t.includes(" ")) return hay.includes(t);
  if (t.length <= 4) return wordMatch(hay, t);
  if (wordMatch(hay, t)) return true;
  return hay.includes(t);
}

function wordMatch(text: string, term: string): boolean {
  if (!text || !term) return false;
  if (term.includes(" ")) return text.includes(term);
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
}

export function buildSearchTerms(query: string, aiKeywords: string[] = []): string[] {
  const terms = expandQueryKeywords(query);
  const expanded = new Set<string>();
  const ql = query.toLowerCase();

  for (const t of terms) {
    expanded.add(t);
    for (const alias of QUERY_ALIASES[t] ?? []) {
      expanded.add(alias);
    }
  }

  for (const k of sanitizeAiKeywords(aiKeywords)) {
    expanded.add(k);
    const first = k.split(/\s+/)[0];
    if (first && QUERY_ALIASES[first]) {
      for (const alias of QUERY_ALIASES[first]) expanded.add(alias);
    }
  }

  if (ql.includes("mythos")) {
    for (const t of ["mythos", "anthropic", "claude", "opus"]) expanded.add(t);
  }

  return [...expanded];
}

function meetsTopicCoverage(hay: string, query: string): boolean | null {
  const ql = query.toLowerCase();
  if (ql.includes("mythos")) {
    return (
      hay.includes("mythos") ||
      (hay.includes("anthropic") && hay.includes("claude")) ||
      hay.includes("claude opus")
    );
  }
  return null;
}

function primaryText(a: ArticleRecord): string {
  return [
    a.title,
    a.displayTitle ?? "",
    a.summary,
    a.displaySummary ?? "",
    a.entities.join(" "),
    a.keywords.join(" "),
    ...a.keyFacts,
  ]
    .join(" ")
    .toLowerCase();
}

function primaryFieldsMatch(a: ArticleRecord, term: string): boolean {
  return textMatchesTerm(primaryText(a), term);
}

/** Multi-word queries require all terms; single-word uses expanded synonym set in primary fields. */
function meetsRequiredCoverage(
  a: ArticleRecord,
  requiredTerms: string[],
  query: string,
  searchTerms: string[],
): boolean {
  const hay = primaryText(a);
  const topic = meetsTopicCoverage(hay, query);
  if (topic !== null) return topic;

  if (requiredTerms.length <= 1) {
    return searchTerms.some((t) => primaryFieldsMatch(a, t));
  }

  return requiredTerms.every((t) => textMatchesTerm(hay, t));
}

function scoreTerm(a: ArticleRecord, term: string): { score: number; inPrimary: boolean } {
  const title = [a.title, a.displayTitle ?? ""].join(" ").toLowerCase();
  const summary = [a.summary, a.displaySummary ?? ""].join(" ").toLowerCase();
  const entities = a.entities.join(" ").toLowerCase();
  const keywords = a.keywords.join(" ").toLowerCase();
  const facts = a.keyFacts.join(" ").toLowerCase();
  const body = a.articleText.toLowerCase().slice(0, 6000);

  let score = 0;
  let inPrimary = false;

  if (textMatchesTerm(title, term)) {
    score += TITLE_WORD;
    inPrimary = true;
  } else if (term.length > 4 && title.includes(term.toLowerCase())) {
    score += TITLE_CONTAINS;
    inPrimary = true;
  }

  if (textMatchesTerm(entities, term)) {
    score += ENTITY;
    inPrimary = true;
  }
  if (textMatchesTerm(keywords, term)) {
    score += KEYWORD;
    inPrimary = true;
  }
  if (textMatchesTerm(summary, term)) {
    score += SUMMARY;
    inPrimary = true;
  } else if (term.length > 4 && summary.includes(term.toLowerCase())) {
    score += SUMMARY * 0.5;
    inPrimary = true;
  }
  if (textMatchesTerm(facts, term)) {
    score += KEY_FACT;
    inPrimary = true;
  }

  if (textMatchesTerm(body, term)) score += BODY_WORD;
  else if (term.length > 4 && body.includes(term.toLowerCase())) score += BODY_CONTAINS;

  return { score, inPrimary };
}

function scoreArticle(
  a: ArticleRecord,
  requiredTerms: string[],
  searchTerms: string[],
): RankedHit {
  let total = 0;
  let primaryHits = 0;

  for (const term of searchTerms) {
    const { score, inPrimary } = scoreTerm(a, term);
    total += score;
    if (inPrimary) primaryHits++;
  }

  if (requiredTerms.length === 1 && primaryHits === 0) {
    const bodyOnly = searchTerms.some((t) => textMatchesTerm(a.articleText.toLowerCase(), t));
    if (!bodyOnly) return { id: a.id, score: 0, matchLabel: "low" };
    total = Math.min(total, 10);
  }

  const label: RankedHit["matchLabel"] =
    total >= 50 ? "high" : total >= 22 ? "medium" : total > 0 ? "low" : "low";

  return { id: a.id, score: Math.round(total), matchLabel: label };
}

function applyRelevanceCutoff(ranked: RankedHit[], query: string): RankedHit[] {
  const positive = ranked.filter((h) => h.score > 0).sort((a, b) => b.score - a.score);
  if (!positive.length) return [];

  const top = positive[0].score;
  const tokens = expandQueryKeywords(query);
  const shortSingle = tokens.length === 1 && tokens[0].length <= 4;
  const ratio = shortSingle ? 0.58 : 0.42;
  const floor = shortSingle ? 24 : 18;
  const cutoff = Math.max(floor, top * ratio);

  return positive.filter((h) => h.score >= cutoff);
}

/**
 * Rank articles for a user query with AI-style intent matching.
 * - Title/entity weighted over body
 * - Multi-word = all terms required in primary fields
 * - Single-word = synonym / AI-expanded terms in primary fields
 * - Drops weak tail results
 */
export function rankArticlesForQuery(
  articles: ArticleRecord[],
  query: string,
  limit = 24,
  options: RankOptions = {},
): RankedHit[] {
  const q = query.trim();
  if (!q || !articles.length) return [];

  const requiredTerms = expandQueryKeywords(q);
  const searchTerms = buildSearchTerms(q, options.aiKeywords);
  if (!searchTerms.length) return [];

  const scored = articles
    .filter((a) => meetsRequiredCoverage(a, requiredTerms, q, searchTerms))
    .map((a) => scoreArticle(a, requiredTerms, searchTerms));

  return applyRelevanceCutoff(scored, q).slice(0, limit);
}

/** Build searchable article from RSS headline (not yet indexed). */
export function rssItemToSearchArticle(item: RssItem): ArticleRecord {
  return {
    id: item.id,
    url: item.link,
    source: item.source,
    sourceKey: item.sourceKey,
    title: item.title,
    image: item.image,
    publishDate: item.published,
    publishedTs: item.publishedTs,
    articleText: item.description,
    summary: item.description.slice(0, 400),
    keyFacts: [],
    keywords: [],
    entities: [],
    clusterId: item.id,
    confidence: "LOW",
    fetchedAt: 0,
    summarizedAt: 0,
  };
}

/** Search all RSS headlines, including not-yet-indexed queue. */
export function rankRssHeadlinesForQuery(
  items: RssItem[],
  query: string,
  excludeUrls: Set<string>,
  limit = 40,
  options: RankOptions = {},
): RankedHit[] {
  const pending = items.filter((i) => !excludeUrls.has(i.link));
  const asArticles = pending.map(rssItemToSearchArticle);
  return rankArticlesForQuery(asArticles, query, limit, options);
}

/** Returns true if top hit is plausibly about the query (for acceptance tests). */
export function isTopHitRelevant(article: ArticleRecord, query: string, aiKeywords: string[] = []): boolean {
  const terms = expandQueryKeywords(query);
  const searchTerms = buildSearchTerms(query, aiKeywords);
  if (terms.length <= 1) {
    return searchTerms.some((t) => primaryFieldsMatch(article, t));
  }
  const hay = primaryText(article);
  return terms.every((t) => textMatchesTerm(hay, t));
}
