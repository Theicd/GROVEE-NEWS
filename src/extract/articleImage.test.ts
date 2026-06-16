import { describe, expect, it } from "vitest";
import { extractArticleImageFromHtml, resolveImageUrl } from "./articleImage";

describe("articleImage", () => {
  it("resolves relative image URLs against the article page", () => {
    expect(resolveImageUrl("/media/hero.jpg", "https://example.com/news/story")).toBe(
      "https://example.com/media/hero.jpg",
    );
  });

  it("extracts og:image from HTML head", () => {
    const html = `<!doctype html><html><head>
      <meta property="og:image" content="https://cdn.example.com/photo.jpg" />
    </head><body></body></html>`;
    expect(extractArticleImageFromHtml(html, "https://example.com/a")).toBe("https://cdn.example.com/photo.jpg");
  });

  it("falls back to twitter:image then first img tag", () => {
    const html = `<html><head>
      <meta name="twitter:image" content="/images/story.png" />
    </head><body><p>text</p></body></html>`;
    expect(extractArticleImageFromHtml(html, "https://news.site/article")).toBe("https://news.site/images/story.png");

    const noMeta = `<html><body><img src="https://img.site/pic.webp" width="800" /></body></html>`;
    expect(extractArticleImageFromHtml(noMeta, "https://news.site/a")).toBe("https://img.site/pic.webp");
  });
});
