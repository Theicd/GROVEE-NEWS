import { describe, expect, it } from "vitest";
import { buildSummarizePrompt, parseSummarizerOutput, parseExpansionOutput } from "../summarize/prompts";

describe("summarize prompts", () => {
  it("parses bullet facts from model output", () => {
    const raw = `Summary paragraph here.
- Fact one about the event
- Fact two with numbers 500
Entities: NASA, Washington
Keywords: space, launch`;
    const r = parseSummarizerOutput(raw);
    expect(r.keyFacts.length).toBeGreaterThanOrEqual(2);
    expect(r.entities).toContain("NASA");
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(r.summary.length).toBeGreaterThan(10);
  });

  it("builds summarize prompt with article body", () => {
    const p = buildSummarizePrompt("Breaking news text here.");
    expect(p).toContain("SUMMARY:");
    expect(p).toContain("Breaking news text here.");
  });

  it("parses query expansion commas", () => {
    const k = parseExpansionOutput("automobile, vehicle, automotive, ev, truck");
    expect(k).toContain("automobile");
    expect(k).toContain("truck");
  });
});
