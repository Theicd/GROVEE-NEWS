import { describe, expect, it } from "vitest";
import { rankArticlesForQuery, rankRssHeadlinesForQuery } from "../search/relevance";
import type { ArticleRecord, RssItem } from "../types";
import { TOPIC_LANES } from "./topicLanes";

function article(id: string, title: string, summary: string): ArticleRecord {
  return {
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
  };
}

function rss(id: string, title: string, description: string): RssItem {
  return {
    id,
    link: `https://example.com/${id}`,
    title,
    description,
    source: "Test RSS",
    sourceKey: "test",
    category: "world",
    published: new Date().toISOString(),
    publishedTs: Date.now(),
    image: "",
    fetchedAt: Date.now(),
  };
}

describe("topic lanes single-word queries", () => {
  const corpus: ArticleRecord[] = [
    article("i1", "Israel and Gaza ceasefire talks resume", "Diplomats meet in Cairo over hostage deal."),
    article("a1", "OpenAI ships faster language model", "Artificial intelligence API latency drops."),
    article("s1", "NASA Mars rover finds new rock samples", "Space agency extends mission on red planet."),
    article("c1", "Tesla unveils affordable electric car", "Automaker targets mass market EV buyers."),
    article("g1", "PlayStation exclusive game breaks sales record", "Gaming industry sees strong quarter."),
    article("f1", "Hollywood blockbuster tops box office", "Major studio film opens worldwide."),
    article("w1", "Military conflict escalates on eastern front", "Troops advance amid ceasefire talks."),
    article("cy1", "Major ransomware breach hits hospital network", "Cybersecurity teams contain malware spread."),
    article("m1", "Grammy-winning artist announces world tour", "New album tops streaming charts."),
    article("t1", "Acupuncture study explores herbal remedies", "Traditional Chinese medicine research published."),
    article("sp1", "Champions League football final preview", "Top clubs meet in championship match."),
    article("fd1", "Chef opens new restaurant with seasonal menu", "Fine dining and culinary trends."),
  ];

  const headlines: RssItem[] = [
    rss("h1", "Ukraine front line update", "Military reports from eastern region."),
    rss("h2", "Fashion week runway highlights", "Designers show spring collections."),
  ];

  it("each lane query matches at least one item in a mixed corpus", () => {
    const indexedUrls = new Set(corpus.map((a) => a.url));

    const expectLane = (query: string) => {
      const fromArticles = rankArticlesForQuery(corpus, query, 3);
      const fromRss = rankRssHeadlinesForQuery(headlines, query, indexedUrls, 3);
      expect(fromArticles.length + fromRss.length, `no hits for "${query}"`).toBeGreaterThan(0);
    };

    expectLane("israel");
    expectLane("ai");
    expectLane("space");
    expectLane("car");
    expectLane("gaming");
    expectLane("film");
    expectLane("ukraine");
    expectLane("fashion");
    expectLane("war");
    expectLane("cyber");
    expectLane("music");
    expectLane("tcm");
    expectLane("sport");
    expectLane("food");
  });

  it("multi-word query returns fewer hits than single-word for same topic", () => {
    const single = rankArticlesForQuery(corpus, "car", 10);
    const multi = rankArticlesForQuery(corpus, "electric car review", 10);
    expect(single.length).toBeGreaterThanOrEqual(multi.length);
  });

  it("has 20 topic lanes without duplicate queries", () => {
    const queries = TOPIC_LANES.map((l) => l.query);
    expect(queries.length).toBe(20);
    expect(new Set(queries).size).toBe(20);
    for (const lane of TOPIC_LANES) {
      expect(lane.query.split(/\s+/).length, lane.id).toBe(1);
    }
  });
});
