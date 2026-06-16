import { describe, expect, it } from "vitest";
import { fallbackArticleSearch, indexArticles, resetSearchIndex, searchIndex } from "./flexIndex";
import type { ArticleRecord } from "../types";

const sample: ArticleRecord[] = [
  {
    id: "dw::1",
    url: "https://example.com/1",
    source: "Deutsche Welle",
    sourceKey: "dw",
    title: "Trump hosts White House event",
    image: "",
    publishDate: new Date().toISOString(),
    publishedTs: Date.now(),
    articleText: "President Trump hosted an event at the White House.",
    summary: "Trump White House birthday celebration with guests.",
    keyFacts: ["Trump", "White House"],
    keywords: ["trump", "politics"],
    entities: ["Trump", "Washington"],
    clusterId: "c1",
    confidence: "LOW",
    fetchedAt: Date.now(),
    summarizedAt: Date.now(),
  },
  {
    id: "sciencedaily::2",
    url: "https://example.com/2",
    source: "ScienceDaily",
    sourceKey: "sciencedaily",
    title: "Geothermal energy potential for US homes",
    image: "",
    publishDate: new Date().toISOString(),
    publishedTs: Date.now(),
    articleText: "Geothermal systems could heat millions of American homes.",
    summary: "Geothermal energy offers clean heating for residential buildings.",
    keyFacts: ["geothermal", "homes"],
    keywords: ["energy", "geothermal"],
    entities: ["US"],
    clusterId: "c2",
    confidence: "MEDIUM",
    fetchedAt: Date.now(),
    summarizedAt: Date.now(),
  },
];

describe("flexIndex search", () => {
  it("finds articles by keyword", async () => {
    resetSearchIndex();
    await indexArticles(sample);
    const trump = await searchIndex("trump");
    expect(trump.length).toBeGreaterThan(0);
    expect(trump[0].id).toBe("dw::1");

    const geo = await searchIndex("geothermal");
    expect(geo.length).toBeGreaterThan(0);

    const energy = await searchIndex("energy");
    expect(energy.length).toBeGreaterThan(0);
  });

  it("fallback finds articles when index empty", () => {
    resetSearchIndex();
    const hits = fallbackArticleSearch(sample, "trump");
    expect(hits.length).toBeGreaterThan(0);
  });
});
