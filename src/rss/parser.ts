import type { RssItem } from "../types";

function decodeXml(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function pickTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function pickLink(block: string): string {
  const atom = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (atom?.[1]) return atom[1].trim();
  return pickTag(block, "link");
}

function pickImage(block: string): string {
  const media = block.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
  if (media?.[1]) return media[1];
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosure?.[1]) return enclosure[1];
  const img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  return img?.[1]?.trim() ?? "";
}

function parseDate(raw: string): { iso: string; ts: number } {
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) {
    const now = Date.now();
    return { iso: new Date(now).toISOString(), ts: now };
  }
  return { iso: new Date(ts).toISOString(), ts };
}

function itemBlocks(xml: string): string[] {
  const rss = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  if (rss.length) return rss;
  return [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
}

export function parseRssXml(
  xml: string,
  meta: { source: string; sourceKey: string; category: string },
  limit = 40,
): RssItem[] {
  const items: RssItem[] = [];
  for (const block of itemBlocks(xml)) {
    const title = pickTag(block, "title");
    const link = pickLink(block);
    if (!title || !link) continue;

    const guid = pickTag(block, "guid") || pickTag(block, "id") || link;
    const description = pickTag(block, "description") || pickTag(block, "summary") || pickTag(block, "content");
    const pubRaw = pickTag(block, "pubDate") || pickTag(block, "published") || pickTag(block, "updated");
    const { iso, ts } = parseDate(pubRaw);
    const image = pickImage(block);
    const id = `${meta.sourceKey}::${guid}`.slice(0, 240);

    items.push({
      id,
      title,
      description,
      source: meta.source,
      sourceKey: meta.sourceKey,
      category: meta.category,
      link,
      image,
      published: iso,
      publishedTs: ts,
      guid,
    });
    if (items.length >= limit) break;
  }
  return items;
}
