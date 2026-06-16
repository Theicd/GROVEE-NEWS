import { describe, expect, it } from "vitest";
import { rankArticlesForQuery } from "../search/relevance";
import type { ArticleRecord } from "../types";

const article = (id: string, title: string, summary: string): ArticleRecord => ({
  id,
  url: `https://example.com/${id}`,
  source: "Test",
  sourceKey: "test",
  title,
  image: "",
  publishDate: new Date().toISOString(),
  publishedTs: Date.now(),
  articleText: summary,
  summary,
  keyFacts: [],
  keywords: [],
  entities: [],
  clusterId: id,
  confidence: "LOW",
  fetchedAt: Date.now(),
  summarizedAt: Date.now(),
});

describe("search without model", () => {
  it("ranks trump articles first", () => {
    const articles = [
      article("1", "Trump hosts White House event", "President Trump at the White House"),
      article("2", "Geothermal energy for homes", "Clean energy heating systems"),
    ];
    const hits = rankArticlesForQuery(articles, "trump");
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe("1");
  });
});
