import { describe, expect, it } from "vitest";
import { INTELLIGENCE_FEEDS } from "./englishFeeds";

describe("extended feed catalog", () => {
  it("includes sports and food categories", () => {
    const sports = INTELLIGENCE_FEEDS.filter((f) => f.category === "sports");
    const food = INTELLIGENCE_FEEDS.filter((f) => f.category === "food");
    expect(sports.length).toBeGreaterThanOrEqual(3);
    expect(food.length).toBeGreaterThanOrEqual(3);
  });

  it("uses https URLs for new sports and food feeds", () => {
    const keys = ["bbc_sport", "espn", "skynews_sport", "eater", "bonappetit", "thekitchn"];
    const byKey = new Map(INTELLIGENCE_FEEDS.map((f) => [f.key, f]));
    for (const key of keys) {
      const feed = byKey.get(key);
      expect(feed, key).toBeDefined();
      expect(feed!.url.startsWith("https://"), key).toBe(true);
    }
  });
});
