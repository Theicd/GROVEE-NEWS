import { describe, expect, it } from "vitest";
import { parseSummarizerOutput } from "../summarize/prompts";
import {
  isBoilerplateSummary,
  isFailedExtraction,
  normalizeSummarizerResult,
  pickDisplaySummary,
} from "../summarize/summaryQuality";

describe("summary quality", () => {
  it("rejects paywall / challenge page titles", () => {
    expect(isFailedExtraction("Client Challenge", "Please enable JavaScript")).toBe(true);
    expect(isFailedExtraction("Just a moment...", "cloudflare")).toBe(true);
    expect(isFailedExtraction("Normal headline", "Full article body with enough content.")).toBe(false);
  });

  it("detects boilerplate model intros", () => {
    expect(isBoilerplateSummary("Here is the summarized version of the article:")).toBe(true);
    expect(
      isBoilerplateSummary(
        "District voters cast ballots in five primary races across the capital region on Tuesday.",
      ),
    ).toBe(false);
  });

  it("falls back to RSS when model output is meta junk", () => {
    const text = pickDisplaySummary(
      "Here is a summarized version of the provided news article: *Summary**",
      "",
      "Election results",
      "Voters in the District of Columbia chose candidates in five primary races Tuesday.",
    );
    expect(text).toContain("five primary races");
    expect(text).not.toMatch(/here is/i);
  });

  it("parses structured Qwen output without keeping intro lines", () => {
    const raw = `SUMMARY: NASA launched a new Earth observation satellite from Florida on Monday night.
FACTS:
- Launch occurred at 9:14 p.m. Eastern
- Satellite will monitor ocean temperatures
- Mission cost is $420 million
ENTITIES: NASA, Florida
KEYWORDS: space, satellite, launch`;
    const r = parseSummarizerOutput(raw);
    expect(r.summary).toContain("NASA launched");
    expect(r.keyFacts.length).toBeGreaterThanOrEqual(2);
    expect(r.summary).not.toMatch(/here is/i);
  });

  it("normalizes weak model output using facts", () => {
    const normalized = normalizeSummarizerResult(
      {
        summary: "Here is the summarized version of the article:",
        keyFacts: ["Five primary races were on the ballot", "Results posted after polls closed"],
        entities: [],
        keywords: [],
      },
      "DC primary election results for 2026.",
      "",
      "DC primary results",
    );
    expect(normalized.summary).toContain("primary");
    expect(normalized.summary).not.toMatch(/here is/i);
  });

  it("rejects reader-proxy dumps as display text", () => {
    const dump =
      "Title: BBVA puts AI at the core of banking URL Source: https://openai.com/index/bbva Markdown Content: Founded in 1857, BBVA is a global financial institution.";
    expect(isBoilerplateSummary(dump)).toBe(true);
    const shown = pickDisplaySummary(dump, dump, "BBVA puts AI at the core of banking with OpenAI");
    expect(shown).toContain("Founded in 1857");
    expect(shown).not.toContain("URL Source");
    expect(shown.length).toBeLessThanOrEqual(280);
  });
});
