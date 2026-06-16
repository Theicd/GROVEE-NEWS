import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { extractArticleImageFromHtml } from "./articleImage";
import { normalizeArticleBody } from "./normalizeArticleBody";
import { fetchRemoteText } from "../fetch/remoteFetch";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

export type ExtractedArticle = {
  title: string;
  text: string;
  image: string;
};

export async function extractArticleFromUrl(url: string, fallbackTitle = ""): Promise<ExtractedArticle> {
  const raw = await fetchRemoteText(url);
  const normalized = normalizeArticleBody(raw, fallbackTitle);

  if (normalized.body && !raw.trimStart().startsWith("<")) {
    return {
      title: normalized.title || fallbackTitle || "Untitled",
      text: normalized.body.slice(0, 16_000),
      image: extractArticleImageFromHtml(raw, url),
    };
  }

  const html = raw;
  const ogImage = extractArticleImageFromHtml(html, url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article?.textContent?.trim()) {
    const plain = DOMPurify.sanitize(doc.body?.innerHTML ?? "", { ALLOWED_TAGS: [] });
    return {
      title: fallbackTitle || doc.title || "Untitled",
      text: plain.slice(0, 12_000),
      image: ogImage,
    };
  }

  const cleanHtml = DOMPurify.sanitize(article.content ?? "");
  const markdown = turndown.turndown(cleanHtml).slice(0, 16_000);

  return {
    title: article.title || fallbackTitle || doc.title || "Untitled",
    text: markdown,
    image: ogImage,
  };
}
