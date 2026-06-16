import { describe, expect, it } from "vitest";
import { isBlockedArticle, isBlockedNewsItem, isBlockedRssItem } from "./blockedFeeds";

describe("blockedFeeds", () => {
  it("blocks removed world outlets by key, label, and URL", () => {
    const blocked = [
      { sourceKey: "bbc", source: "BBC News", url: "https://www.bbc.co.uk/news/1" },
      { sourceKey: "cnn", source: "CNN", url: "https://www.cnn.com/2026/1/1" },
      { sourceKey: "guardian", source: "The Guardian", url: "https://www.theguardian.com/world/1" },
      { sourceKey: "npr", source: "NPR", url: "https://www.npr.org/sections/news/1" },
      { sourceKey: "cbc", source: "CBC", url: "https://www.cbc.ca/news/1" },
      { sourceKey: "france24", source: "France 24", url: "https://www.france24.com/en/foo" },
      { sourceKey: "lemonde", source: "Le Monde", url: "https://www.lemonde.fr/article" },
      { sourceKey: "aljazeera", source: "Al Jazeera", url: "https://www.aljazeera.com/a" },
      { sourceKey: "bloomberg", source: "Bloomberg", url: "https://www.bloomberg.com/news/articles/1" },
      { sourceKey: "cnbc", source: "CNBC", url: "https://www.cnbc.com/2026/01/01/article.html" },
      { sourceKey: "spiegel", source: "Der Spiegel", url: "https://www.spiegel.de/politik/ausland/example-abc123.html" },
    ];
    for (const item of blocked) {
      expect(isBlockedNewsItem(item), JSON.stringify(item)).toBe(true);
    }
  });

  it("does not block unrelated outlets", () => {
    expect(isBlockedNewsItem({ sourceKey: "dw", source: "Deutsche Welle" })).toBe(false);
    expect(isBlockedNewsItem({ sourceKey: "skynews", source: "Sky News", url: "https://news.sky.com/story/1" })).toBe(false);
    expect(isBlockedNewsItem({ sourceKey: "techcrunch", source: "TechCrunch" })).toBe(false);
    expect(isBlockedNewsItem({ sourceKey: "ft", source: "Financial Times", url: "https://www.ft.com/content/foo" })).toBe(false);
  });

  it("blocks stored article and rss records", () => {
    expect(
      isBlockedArticle({
        id: "x",
        url: "https://www.bbc.co.uk/news/1",
        source: "BBC News",
        sourceKey: "bbc",
        title: "t",
        image: "",
        publishDate: "",
        publishedTs: 0,
        articleText: "",
        summary: "",
        keyFacts: [],
        keywords: [],
        entities: [],
        clusterId: "x",
        confidence: "LOW",
        fetchedAt: 0,
        summarizedAt: 0,
      }),
    ).toBe(true);

    expect(
      isBlockedRssItem({
        id: "cnn::1",
        title: "Headline",
        description: "",
        source: "CNN",
        sourceKey: "cnn",
        category: "world",
        link: "https://www.cnn.com/1",
        image: "",
        published: "",
        publishedTs: 0,
        guid: "1",
      }),
    ).toBe(true);
  });
});
