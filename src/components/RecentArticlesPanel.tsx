import { useEffect, useState } from "react";
import { getRecentArticles } from "../storage/db";
import type { ArticleRecord } from "../types";

export function RecentArticlesPanel() {
  const [articles, setArticles] = useState<ArticleRecord[]>([]);

  useEffect(() => {
    void getRecentArticles(12).then(setArticles);
    const id = setInterval(() => void getRecentArticles(12).then(setArticles), 8000);
    return () => clearInterval(id);
  }, []);

  if (!articles.length) {
    return (
      <section className="gn-recent gn-recent--empty">
        <h3>Saved articles (local)</h3>
        <p>No articles in browser storage yet. They persist across page refresh once indexed.</p>
      </section>
    );
  }

  return (
    <section className="gn-recent">
      <h3>Saved articles ({articles.length} shown) — stored on your device</h3>
      <ul className="gn-recent__list">
        {articles.map((a) => (
          <li key={a.id} className="gn-recent__item">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="gn-recent__title">
              {a.title}
            </a>
            <span className="gn-recent__meta">
              {a.source}
              {a.summarizedAt > 0 ? " · Qwen" : " · RSS"}
            </span>
            <p className="gn-recent__summary">{a.summary.slice(0, 160)}…</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
