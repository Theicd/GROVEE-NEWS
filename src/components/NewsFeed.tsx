import { useEffect, useRef, useState } from "react";
import { buildDailyBriefing } from "../briefing/buildBriefing";
import { buildNewsFeed, type FeedItem } from "../feed/buildFeed";
import { FeedCard } from "./FeedCard";

type FeedMode = "live" | "briefing";

type NewsFeedProps = {
  refreshKey: number;
  articlesIndexed: number;
};

export function NewsFeed({ refreshKey, articlesIndexed }: NewsFeedProps) {
  const [mode, setMode] = useState<FeedMode>("live");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const [debouncedKey, setDebouncedKey] = useState(refreshKey);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKey(refreshKey), 800);
    return () => window.clearTimeout(timer);
  }, [refreshKey]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const firstLoad = items.length === 0;
    if (firstLoad) setLoading(true);

    const loader = mode === "briefing" ? buildDailyBriefing(20) : buildNewsFeed();

    void loader
      .then((feed) => {
        if (requestId !== requestRef.current) return;
        setItems(feed);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (requestId !== requestRef.current) return;
        console.error("[NewsFeed] load failed", err);
        setError(err instanceof Error ? err.message : "Failed to load feed");
        setLoading(false);
      });
  }, [debouncedKey, mode]);

  if (loading && !items.length && !error) {
    return (
      <section className="gn-feed gn-feed--loading">
        <p>{mode === "briefing" ? "Building today’s briefing…" : "Loading intelligence feed…"}</p>
      </section>
    );
  }

  if (error && !items.length) {
    return (
      <section className="gn-feed gn-feed--empty">
        <h2>Feed error</h2>
        <p>{error}</p>
      </section>
    );
  }

  const trending = items.filter((i) => i.kind === "trending").length;
  const articles = items.filter((i) => i.kind === "article").length;

  return (
    <section className="gn-feed" aria-label="News intelligence feed">
      <header className="gn-feed__head">
        <div className="gn-feed__tabs">
          <button
            type="button"
            className={`gn-feed__tab${mode === "live" ? " gn-feed__tab--active" : ""}`}
            onClick={() => setMode("live")}
          >
            Live feed
          </button>
          <button
            type="button"
            className={`gn-feed__tab${mode === "briefing" ? " gn-feed__tab--active" : ""}`}
            onClick={() => setMode("briefing")}
          >
            Today&apos;s briefing
          </button>
        </div>
        <p>
          {mode === "briefing"
            ? `${items.length} stories · last 24h · balanced across topics`
            : `${trending} trending · ${articles} summaries · sorted by latest`}
          {loading ? " · updating…" : ""}
        </p>
      </header>

      {!items.length ? (
        <p className="gn-feed__empty-inline">
          {mode === "briefing"
            ? "No briefing items yet — run Refresh feeds in ENGINE after Qwen finishes summarizing."
            : `Summaries appear as Qwen processes headlines (${articlesIndexed} indexed so far).`}
        </p>
      ) : (
        <div className="gn-feed__stream">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
