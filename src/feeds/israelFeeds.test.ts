import { describe, expect, it } from "vitest";
import { INTELLIGENCE_FEEDS } from "./englishFeeds";

const ISRAEL_KEYS = [
  "jpost_front",
  "jpost_israel",
  "jpost_middleeast",
  "jpost_business",
  "toi_main",
  "toi_israel",
  "toi_middleeast",
  "ynet_all",
  "ynet_hot",
  "ynet_opinions",
  "inn_main",
  "inn_news",
  "inn_opinion",
  "globes_main",
  "globes_market",
  "globes_tech",
];

describe("israel feeds catalog", () => {
  it("registers all requested Israel English sources", () => {
    const keys = new Set(INTELLIGENCE_FEEDS.map((f) => f.key));
    for (const key of ISRAEL_KEYS) {
      expect(keys.has(key), `missing feed ${key}`).toBe(true);
    }
  });

  it("marks Israel feeds as english or multi with https URLs", () => {
    const israel = INTELLIGENCE_FEEDS.filter((f) => f.category === "israel");
    expect(israel.length).toBe(ISRAEL_KEYS.length);
    for (const f of israel) {
      expect(f.url.startsWith("https://"), f.key).toBe(true);
      expect(["en", "multi"]).toContain(f.language ?? "en");
    }
  });

  it("uses Google News fallback where native RSS is unreliable", () => {
    const withGoogle = INTELLIGENCE_FEEDS.filter(
      (f) =>
        f.category === "israel" &&
        (f.url.includes("news.google.com") ||
          f.fallbackUrls?.some((u) => u.includes("news.google.com"))),
    );
    expect(withGoogle.length).toBeGreaterThanOrEqual(8);
  });
});
