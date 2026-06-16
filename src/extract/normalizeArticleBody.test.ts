import { describe, expect, it } from "vitest";
import { cleanDisplayText, isReaderProxyDump, normalizeArticleBody } from "./normalizeArticleBody";

const JINA_SAMPLE = `Title: BBVA puts AI at the core of banking with OpenAI
URL Source: https://openai.com/index/bbva
Published Time: 2026-06-11

Markdown Content:
Founded in 1857, BBVA is a global financial institution supporting people and businesses across Europe.

### Section heading

> "Our alliance with OpenAI accelerates the native integration of artificial intelligence."`;

describe("normalizeArticleBody", () => {
  it("detects reader proxy dumps", () => {
    expect(isReaderProxyDump(JINA_SAMPLE)).toBe(true);
    expect(isReaderProxyDump("Short normal summary about banking.")).toBe(false);
  });

  it("extracts title and body from Jina-style text", () => {
    const { title, body } = normalizeArticleBody(JINA_SAMPLE);
    expect(title).toBe("BBVA puts AI at the core of banking with OpenAI");
    expect(body).toContain("Founded in 1857, BBVA");
    expect(body).not.toContain("URL Source:");
    expect(body).not.toContain("Markdown Content:");
    expect(body).not.toMatch(/^###/m);
  });

  it("cleans reader dumps for display", () => {
    const shown = cleanDisplayText(
      "Title: Foo URL Source: https://x.com Markdown Content: Real story starts here with enough text to show.",
    );
    expect(shown).toContain("Real story starts");
    expect(shown).not.toContain("URL Source");
  });
});
