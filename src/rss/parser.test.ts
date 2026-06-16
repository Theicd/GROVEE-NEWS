import { describe, expect, it } from "vitest";
import { parseRssXml } from "../rss/parser";

const SAMPLE = `<?xml version="1.0"?>
<rss><channel>
<item><title><![CDATA[Test Headline]]></title><link>https://example.com/a</link><guid>1</guid><pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate><description>Summary here</description></item>
</channel></rss>`;

describe("parseRssXml", () => {
  it("parses RSS items", () => {
    const items = parseRssXml(SAMPLE, { source: "Test", sourceKey: "test", category: "world" });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Test Headline");
    expect(items[0].link).toBe("https://example.com/a");
  });
});
