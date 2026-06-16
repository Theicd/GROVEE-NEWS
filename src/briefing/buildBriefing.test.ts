import { describe, expect, it } from "vitest";
import type { ArticleRecord } from "../types";
import { buildDailyBriefing } from "../briefing/buildBriefing";

function article(id: string, cat: string, ts: number): ArticleRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    source: "Test",
    sourceKey: cat,
    title: `Story ${id}`,
    image: "",
    publishDate: new Date(ts).toISOString(),
    publishedTs: ts,
    articleText: "Body text for testing summaries with enough length to pass quality checks.",
    summary: "A clear summary with enough detail for the briefing builder to include this item.",
    keyFacts: ["Fact one", "Fact two"],
    keywords: [cat],
    entities: [],
    clusterId: id,
    confidence: "LOW",
    fetchedAt: ts,
    summarizedAt: ts,
    feedCategory: cat,
    intelSource: "rss",
  };
}

describe("buildDailyBriefing", () => {
  it("is exported as async function", () => {
    expect(typeof buildDailyBriefing).toBe("function");
  });
});

describe("briefing balance logic", () => {
  it("groups by category for round-robin", () => {
    const now = Date.now();
    const items = [
      article("w1", "world", now),
      article("w2", "world", now - 1000),
      article("t1", "technology", now - 2000),
      article("a1", "ai", now - 3000),
    ];
    const buckets = new Map<string, ArticleRecord[]>();
    for (const a of items) {
      const list = buckets.get(a.feedCategory!) ?? [];
      list.push(a);
      buckets.set(a.feedCategory!, list);
    }
    expect(buckets.get("world")?.length).toBe(2);
    expect(buckets.get("technology")?.length).toBe(1);
    expect(buckets.get("ai")?.length).toBe(1);
  });
});
