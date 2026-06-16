import { describe, expect, it } from "vitest";
import { isTopHitRelevant, rankArticlesForQuery, rankRssHeadlinesForQuery } from "./relevance";
import type { ArticleRecord, RssItem } from "../types";

function article(
  id: string,
  title: string,
  summary: string,
  extras: Partial<ArticleRecord> = {},
): ArticleRecord {
  return {
    id,
    url: `https://example.com/${id}`,
    source: "Test",
    sourceKey: "test",
    title,
    image: "",
    publishDate: new Date().toISOString(),
    publishedTs: Date.now(),
    articleText: summary + " Extended body text for search testing.",
    summary,
    keyFacts: extras.keyFacts ?? [],
    keywords: extras.keywords ?? [],
    entities: extras.entities ?? [],
    clusterId: id,
    confidence: "LOW",
    fetchedAt: Date.now(),
    summarizedAt: Date.now(),
    ...extras,
  };
}

const CORPUS: ArticleRecord[] = [
  article("trump-1", "Trump hosts White House cage fights for 80th birthday", "President Trump celebrated at the White House with a lavish event.", {
    entities: ["Donald Trump", "White House"],
    keywords: ["trump", "politics"],
  }),
  article("trump-2", "Donald Trump announces new trade tariffs on China", "The former president outlined economic policy changes affecting imports.", {
    entities: ["Donald Trump", "China"],
  }),
  article("geo-1", "Geothermal energy potential for US homes rises", "Clean heating systems could reach millions of American households.", {
    entities: ["US", "Energy"],
    keywords: ["geothermal", "energy"],
  }),
  article("nasa-1", "NASA launches new Mars observation satellite", "Space agency deploys orbiter to study red planet atmosphere.", {
    entities: ["NASA", "Mars"],
    keywords: ["space", "nasa"],
  }),
  article("ai-1", "OpenAI releases faster language model for developers", "Artificial intelligence startup ships new API with lower latency.", {
    entities: ["OpenAI"],
    keywords: ["ai", "artificial intelligence"],
  }),
  article("war-1", "Ukraine conflict enters fourth year with heavy fighting", "Military operations continue along the eastern front.", {
    entities: ["Ukraine"],
    keywords: ["war", "conflict"],
  }),
  article("noise-1", "Hollywood box office sees summer rebound", "Cinema ticket sales climb after weak spring season.", {
    entities: ["Hollywood"],
    keywords: ["entertainment", "movies"],
  }),
  article("noise-2", "Federal Reserve holds interest rates steady", "Central bank cites inflation progress in latest decision.", {
    entities: ["Federal Reserve"],
    keywords: ["economy", "rates"],
  }),
];

const ACCEPTANCE: Array<{ query: string; mustInclude: string[]; mustExclude: string[] }> = [
  { query: "trump", mustInclude: ["trump-1", "trump-2"], mustExclude: ["geo-1", "nasa-1", "noise-1"] },
  { query: "geothermal energy", mustInclude: ["geo-1"], mustExclude: ["trump-1", "nasa-1", "noise-1"] },
  { query: "nasa space", mustInclude: ["nasa-1"], mustExclude: ["trump-1", "geo-1"] },
  { query: "artificial intelligence", mustInclude: ["ai-1"], mustExclude: ["trump-1", "noise-2"] },
  { query: "ukraine war", mustInclude: ["war-1"], mustExclude: ["geo-1", "noise-1"] },
  { query: "hollywood movies", mustInclude: ["noise-1"], mustExclude: ["trump-1", "nasa-1"] },
];

describe("search relevance acceptance", () => {
  for (const { query, mustInclude, mustExclude } of ACCEPTANCE) {
    it(`"${query}" returns relevant results only`, () => {
      const hits = rankArticlesForQuery(CORPUS, query);
      expect(hits.length).toBeGreaterThan(0);

      const ids = hits.map((h) => h.id);
      for (const id of mustInclude) {
        expect(ids, `expected ${id} for "${query}"`).toContain(id);
      }
      for (const id of mustExclude) {
        expect(ids, `excluded ${id} for "${query}"`).not.toContain(id);
      }

      const top = CORPUS.find((a) => a.id === hits[0].id)!;
      expect(isTopHitRelevant(top, query)).toBe(true);
    });
  }

  it("trump query does not return unrelated tail results", () => {
    const hits = rankArticlesForQuery(CORPUS, "trump", 10);
    const ids = hits.map((h) => h.id);
    expect(ids.every((id) => id.startsWith("trump"))).toBe(true);
  });

  it("mythos 5 finds anthropic/claude headlines not yet indexed", () => {
    const indexed = [
      article("v-1", "Inside the fight over Claude Mythos 5", "Anthropic battles Trump admin over model release.", {
        entities: ["Anthropic", "Claude"],
      }),
    ];
    const rssOnly = [
      {
        id: "tc-1",
        title: "Anthropic delays Claude Opus launch amid government pressure",
        description: "The AI company faces regulatory scrutiny over its latest model.",
        source: "TechCrunch",
        sourceKey: "techcrunch",
        category: "technology",
        link: "https://example.com/1",
        image: "",
        published: new Date().toISOString(),
        publishedTs: Date.now(),
        guid: "1",
      },
      {
        id: "wired-1",
        title: "What Anthropic's Claude fight means for AI regulation",
        description: "Analysis of the standoff between the lab and Washington.",
        source: "Wired",
        sourceKey: "wired",
        category: "technology",
        link: "https://example.com/2",
        image: "",
        published: new Date().toISOString(),
        publishedTs: Date.now(),
        guid: "2",
      },
    ];

    const hits = rankRssHeadlinesForQuery(rssOnly, "Mythos 5", new Set(indexed.map((a) => a.url)), 20);
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("drops low-relevance tail below cutoff", () => {
    const hits = rankArticlesForQuery(CORPUS, "trump");
    if (hits.length >= 2) {
      expect(hits[0].score).toBeGreaterThan(hits[hits.length - 1].score);
    }
  });

  it("car does not match healthcare/carbon via substring", () => {
    const corpus = [
      ...CORPUS,
      article("car-1", "Electric car sales surge in Europe", "Automakers report record EV deliveries.", {
        keywords: ["car", "automotive", "ev"],
      }),
      article("car-noise-1", "Healthcare reform debate intensifies", "Lawmakers discuss insurance and hospital care.", {
        keywords: ["healthcare", "policy"],
      }),
      article("car-noise-2", "Carbon capture project wins funding", "Energy firms invest in reducing emissions.", {
        keywords: ["carbon", "climate"],
      }),
      article("car-noise-3", "Credit card fees under scrutiny", "Banks face new rules on consumer lending.", {
        keywords: ["finance", "banking"],
      }),
    ];
    const hits = rankArticlesForQuery(corpus, "car");
    const ids = hits.map((h) => h.id);
    expect(ids).toContain("car-1");
    expect(ids).not.toContain("car-noise-1");
    expect(ids).not.toContain("car-noise-2");
    expect(ids).not.toContain("car-noise-3");
  });

  it("car matches vehicle synonym when provided by expansion", () => {
    const corpus = [
      article("truck-1", "Truck makers brace for tariff shock", "Commercial vehicle orders slow amid trade war.", {
        keywords: ["truck", "automotive"],
      }),
      article("noise-1", "Hollywood box office sees summer rebound", "Cinema ticket sales climb.", {
        keywords: ["entertainment"],
      }),
    ];
    const hits = rankArticlesForQuery(corpus, "car", 10, {
      aiKeywords: ["automobile", "vehicle", "truck", "automotive"],
    });
    expect(hits.map((h) => h.id)).toContain("truck-1");
    expect(hits.map((h) => h.id)).not.toContain("noise-1");
  });
});
