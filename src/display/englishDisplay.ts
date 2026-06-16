import { isLikelyEnglish, needsEnglishDisplay } from "../summarize/languageDetect";
import type { ArticleRecord } from "../types";
import { translateHeadlineToEnglish } from "../summarize/summarizerClient";

/** Fill English UI fields for feed/search cards. */
export async function ensureEnglishDisplay(article: ArticleRecord): Promise<ArticleRecord> {
  const title = article.displayTitle ?? article.title;
  const summary = article.displaySummary ?? article.summary;

  if (!needsEnglishDisplay(title, summary)) {
    return {
      ...article,
      displayTitle: title,
      displaySummary: summary,
    };
  }

  const translated = await translateHeadlineToEnglish(article.title, summary || article.articleText);
  return {
    ...article,
    displayTitle: translated.title,
    displaySummary: translated.summary,
  };
}

export async function backfillEnglishDisplay(articles: ArticleRecord[], limit = 20): Promise<number> {
  let updated = 0;
  for (const a of articles) {
    if (updated >= limit) break;
    if (a.displayTitle && a.displaySummary && isLikelyEnglish(a.displayTitle)) continue;
    if (!needsEnglishDisplay(a.title, a.summary)) continue;
    await ensureEnglishDisplay(a);
    updated++;
  }
  return updated;
}
