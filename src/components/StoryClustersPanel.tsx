import { useEffect, useState } from "react";
import { getArticlesByCluster, getMultiSourceClusters } from "../storage/db";
import type { ArticleRecord, StoryCluster } from "../types";

type ClusterIntel = {
  cluster: StoryCluster;
  articles: ArticleRecord[];
  mergedFacts: string[];
};

type StoryClustersPanelProps = {
  refreshKey: number;
};

export function StoryClustersPanel({ refreshKey }: StoryClustersPanelProps) {
  const [clusters, setClusters] = useState<ClusterIntel[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const multi = await getMultiSourceClusters();
      const intel: ClusterIntel[] = [];
      for (const cluster of multi.slice(0, 12)) {
        const articles = await getArticlesByCluster(cluster.id);
        const mergedFacts = [...new Set(articles.flatMap((a) => a.keyFacts))].slice(0, 8);
        intel.push({ cluster, articles, mergedFacts });
      }
      setClusters(intel);
    })();
  }, [refreshKey]);

  if (!clusters.length) {
    return (
      <section className="gn-clusters gn-clusters--empty">
        <h3>Cross-source stories</h3>
        <p>No duplicate stories detected yet. Need 2+ sources with similar headlines.</p>
      </section>
    );
  }

  return (
    <section className="gn-clusters">
      <h3>Cross-source stories ({clusters.length})</h3>
      <p className="gn-clusters__sub">Same story from multiple outlets — merged facts below.</p>
      <ul className="gn-cluster-list">
        {clusters.map(({ cluster, articles, mergedFacts }) => {
          const open = expanded === cluster.id;
          return (
            <li key={cluster.id} className={`gn-cluster-card gn-cluster-card--${cluster.confidence.toLowerCase()}`}>
              <button
                type="button"
                className="gn-cluster-card__head"
                onClick={() => setExpanded(open ? null : cluster.id)}
              >
                <span className={`gn-confidence gn-confidence--${cluster.confidence.toLowerCase()}`}>
                  {cluster.confidence}
                </span>
                <span className="gn-cluster-card__title">{cluster.headline}</span>
                <span className="gn-cluster-card__sources">{cluster.sourceKeys.join(" · ")}</span>
              </button>
              {open ? (
                <div className="gn-cluster-card__body">
                  {mergedFacts.length > 0 ? (
                    <ul className="gn-cluster-card__facts">
                      {mergedFacts.map((f, i) => (
                        <li key={`${cluster.id}-fact-${i}`}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                  <ul className="gn-cluster-card__articles">
                    {articles.map((a) => (
                      <li key={a.id}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer">
                          {a.source}
                        </a>
                        <span>{a.summary.slice(0, 120)}…</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
