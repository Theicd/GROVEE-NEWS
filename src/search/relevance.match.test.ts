import { describe, expect, it } from "vitest";
import { buildSearchTerms, sanitizeAiKeywords, textMatchesTerm } from "./relevance";

describe("textMatchesTerm", () => {
  it("matches car as whole word only", () => {
    expect(textMatchesTerm("Electric car sales rise", "car")).toBe(true);
    expect(textMatchesTerm("Healthcare and hospital care", "car")).toBe(false);
    expect(textMatchesTerm("Carbon emissions fall", "car")).toBe(false);
    expect(textMatchesTerm("Credit card limits change", "car")).toBe(false);
  });
});

describe("buildSearchTerms", () => {
  it("merges static and AI synonyms for car", () => {
    const terms = buildSearchTerms("car", ["pickup truck", "automaker"]);
    expect(terms).toContain("car");
    expect(terms).toContain("vehicle");
    expect(terms).toContain("automotive");
    expect(terms).toContain("pickup truck");
  });

  it("strips generic AI expansion noise", () => {
    const cleaned = sanitizeAiKeywords(["automobile", "news", "world", "vehicle"]);
    expect(cleaned).toContain("automobile");
    expect(cleaned).toContain("vehicle");
    expect(cleaned).not.toContain("news");
    expect(cleaned).not.toContain("world");
  });
});
