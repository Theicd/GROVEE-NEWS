import Fuse from "fuse.js";
import type { ArticleRecord, StoryCluster } from "../types";

const FUSE_MATCH_MAX = 0.35;

export function clusterConfidence(sourceCount: number): StoryCluster["confidence"] {
  if (sourceCount >= 4) return "HIGH";
  if (sourceCount >= 2) return "MEDIUM";
  return "LOW";
}

export function assignClusters(articles: ArticleRecord[]): {
  articles: ArticleRecord[];
  clusters: StoryCluster[];
} {
  const fuse = new Fuse(articles, {
    keys: ["title"],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 4,
  });

  const used = new Set<string>();
  const clusters: StoryCluster[] = [];
  const updated = [...articles];

  for (const article of updated) {
    if (used.has(article.id)) continue;

    const matches = fuse.search(article.title).filter((m) => m.item.id !== article.id);
    const group = [article];
    used.add(article.id);

    for (const m of matches) {
      if (used.has(m.item.id)) continue;
      if ((m.score ?? 1) > FUSE_MATCH_MAX) continue;
      group.push(m.item);
      used.add(m.item.id);
    }

    const clusterId = `cluster-${article.id}`;
    const sourceKeys = [...new Set(group.map((a) => a.sourceKey))];
    const confidence = clusterConfidence(sourceKeys.length);

    const cluster: StoryCluster = {
      id: clusterId,
      headline: article.title,
      sourceKeys,
      articleIds: group.map((a) => a.id),
      confidence,
      updatedAt: Date.now(),
    };
    clusters.push(cluster);

    for (const a of group) {
      const idx = updated.findIndex((x) => x.id === a.id);
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], clusterId, confidence };
      }
    }
  }

  return { articles: updated, clusters };
}
