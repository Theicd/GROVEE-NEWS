import { formatFullDate, formatRelativeTime, isFresh } from "../feed/time";
import type { TopicDigestHit } from "../topics/buildTopicsDigest";
import { ArticleMedia } from "./ArticleMedia";

type TopicCardProps = {
  hit: TopicDigestHit;
};

export function TopicCard({ hit }: TopicCardProps) {
  const { article, laneLabel, laneIcon, query, matchLabel, sourceKind } = hit;
  const sortTs = article.publishedTs || article.fetchedAt || Date.now();
  const fresh = isFresh(sortTs);
  const summary = (article.summary || article.articleText || "").slice(0, 280);

  return (
    <article className="gn-post gn-post--topic">
      <header className="gn-post__header">
        <span className="gn-topic-lane" title={`Search: ${query}`}>
          <span className="gn-topic-lane__icon" aria-hidden="true">
            {laneIcon}
          </span>
          <span className="gn-topic-lane__label">{laneLabel}</span>
        </span>
        <div className="gn-post__meta gn-post__meta--topic">
          <strong className="gn-post__source">{article.source}</strong>
          <time className="gn-post__time" dateTime={new Date(sortTs).toISOString()} title={formatFullDate(sortTs)}>
            {formatRelativeTime(sortTs)}
            {fresh ? <span className="gn-post__fresh"> · LIVE</span> : null}
          </time>
        </div>
        <span className={`gn-topic-match gn-topic-match--${matchLabel}`}>{matchLabel}</span>
      </header>

      <div className="gn-post__body">
        <h2 className="gn-post__title">
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h2>
        {summary ? <p className="gn-post__text">{summary}</p> : null}
      </div>

      <ArticleMedia articleId={article.id} url={article.url} title={article.title} image={article.image} />

      <footer className="gn-post__footer">
        <a className="gn-post__action" href={article.url} target="_blank" rel="noopener noreferrer">
          Read article
        </a>
        <span className="gn-post__tag gn-post__tag--topic">keyword: {query}</span>
        {sourceKind === "headline" ? (
          <span className="gn-post__tag">RSS headline</span>
        ) : (
          <span className="gn-post__tag">Indexed</span>
        )}
      </footer>
    </article>
  );
}
