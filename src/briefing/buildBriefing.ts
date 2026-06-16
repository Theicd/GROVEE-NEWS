import { getAllArticles } from "../storage/db";
import { hasDisplayableContent } from "../summarize/summaryQuality";
import type { ArticleFeedItem } from "../feed/buildFeed";
import { articleTimestamp } from "../feed/time";

const BRIEFING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 60-minutes style mix: balanced picks from the last 24h across categories */
export async function buildDailyBriefing(limit = 20): Promise<ArticleFeedItem[]> {
  const cutoff = Date.now() - BRIEFING_WINDOW_MS;
  const all = await getAllArticles();

  const recent = all.filter((a) => {
    const ts = articleTimestamp(a);
    return ts >= cutoff && hasDisplayableContent(a);
  });

  const buckets = new Map<string, typeof recent>();
  for (const article of recent) {
    const cat = article.feedCategory || article.sourceKey || "world";
    const list = buckets.get(cat) ?? [];
    list.push(article);
    buckets.set(cat, list);
  }

  for (const [cat, list] of buckets) {
    list.sort((a, b) => articleTimestamp(b) - articleTimestamp(a));
    buckets.set(cat, list);
  }

  const categories = [...buckets.keys()].sort((a, b) => {
    const priority = (c: string) =>
      c === "world" ? 0 : c === "technology" || c === "ai" || c === "dev" ? 1 : 2;
    return priority(a) - priority(b);
  });

  const picked: ArticleFeedItem[] = [];
  let round = 0;
  while (picked.length < limit) {
    let any = false;
    for (const cat of categories) {
      const list = buckets.get(cat)!;
      if (round < list.length) {
        const article = list[round];
        picked.push({
          kind: "article",
          id: article.id,
          article,
          sortTs: articleTimestamp(article),
        });
        any = true;
        if (picked.length >= limit) break;
      }
    }
    if (!any) break;
    round++;
  }

  return picked.sort((a, b) => b.sortTs - a.sortTs);
}
