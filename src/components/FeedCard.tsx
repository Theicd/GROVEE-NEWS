import type { ArticleFeedItem, FeedItem, TrendingFeedItem } from "../feed/buildFeed";
import { articleTimestamp, formatFullDate, formatRelativeTime, isFresh } from "../feed/time";
import { cleanKeyFacts, pickDisplaySummary, pickDisplayTitle } from "../summarize/summaryQuality";
import type { ArticleRecord } from "../types";
import { ArticleMedia } from "./ArticleMedia";

type FeedCardProps = {
  item: FeedItem;
};

function articleDisplayTitle(article: ArticleRecord): string {
  return pickDisplayTitle(article.title, article.articleText, article.summary, article.displayTitle ?? "");
}

function articleDisplayText(article: ArticleRecord): string {
  return pickDisplaySummary(article.summary, article.articleText, article.title, "", article.displaySummary ?? "");
}

function articleDisplayFacts(article: ArticleRecord): string[] {
  return cleanKeyFacts(article.keyFacts);
}

function sourceInitial(source: string): string {
  const ch = source.trim().charAt(0).toUpperCase();
  return ch || "?";
}

function SourceAvatar({ source }: { source: string }) {
  const hue = source.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  return (
    <span className="gn-post__avatar" style={{ background: `hsl(${hue} 45% 32%)` }} aria-hidden="true">
      {sourceInitial(source)}
    </span>
  );
}

function PostMedia({ article }: { article: ArticleRecord }) {
  return (
    <ArticleMedia
      articleId={article.id}
      url={article.url}
      title={article.title}
      image={article.image}
    />
  );
}

function PostHeader({
  source,
  sortTs,
  extra,
  badge,
}: {
  source: string;
  sortTs: number;
  extra?: string;
  badge?: string;
}) {
  const fresh = isFresh(sortTs);
  return (
    <header className="gn-post__header">
      <SourceAvatar source={source} />
      <div className="gn-post__meta">
        <div className="gn-post__meta-top">
          <strong className="gn-post__source">{source}</strong>
          {extra ? <span className="gn-post__extra">{extra}</span> : null}
        </div>
        <time className="gn-post__time" dateTime={new Date(sortTs).toISOString()} title={formatFullDate(sortTs)}>
          {formatRelativeTime(sortTs)}
          {fresh ? <span className="gn-post__fresh"> · LIVE</span> : null}
        </time>
      </div>
      {badge ? <span className="gn-post__pill">{badge}</span> : null}
    </header>
  );
}

function intelSourceLabel(article: ArticleRecord): string | null {
  if (article.intelSource === "github") return "GitHub project";
  if (article.intelSource === "huggingface") return "HF model";
  return null;
}

function PostFooter({ article }: { article: ArticleRecord }) {
  const summarized = article.summarizedAt > 0;
  const connector = intelSourceLabel(article);
  const linkLabel =
    article.intelSource === "github" ? "Open repository" : article.intelSource === "huggingface" ? "Open model" : "Read article";

  return (
    <footer className="gn-post__footer">
      <a className="gn-post__action" href={article.url} target="_blank" rel="noopener noreferrer">
        {linkLabel}
      </a>
      {connector ? <span className="gn-post__tag gn-post__tag--connector">{connector}</span> : null}
      {summarized ? <span className="gn-post__tag">Qwen summary</span> : <span className="gn-post__tag">RSS summary</span>}
      <span className={`gn-confidence gn-confidence--${article.confidence.toLowerCase()}`}>
        {article.confidence}
      </span>
    </footer>
  );
}

function TrendingCard({ item }: { item: TrendingFeedItem }) {
  const { cluster, lead, articles, mergedFacts, sortTs } = item;
  const sources = cluster.sourceKeys.join(" · ");

  return (
    <article className="gn-post gn-post--trending">
      <PostHeader
        source={lead.source}
        sortTs={sortTs}
        extra={`+${cluster.sourceKeys.length - 1} sources`}
        badge="Trending"
      />
      <div className="gn-post__body">
        <h2 className="gn-post__title">
          <a href={lead.url} target="_blank" rel="noopener noreferrer">
            {articleDisplayTitle(lead)}
          </a>
        </h2>
        <p className="gn-post__sources">{sources}</p>
        <p className="gn-post__text">{articleDisplayText(lead)}</p>
        {mergedFacts.length > 0 ? (
          <ul className="gn-post__facts">
            {cleanKeyFacts(mergedFacts).map((f, i) => (
              <li key={`trend-fact-${i}`}>{f}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <PostMedia article={lead} />
      <div className="gn-post__footer gn-post__footer--multi">
        {articles.slice(0, 4).map((a) => (
          <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
            {a.source}
          </a>
        ))}
      </div>
    </article>
  );
}

function SingleCard({ item }: { item: ArticleFeedItem }) {
  const { article, sortTs } = item;

  return (
    <article className="gn-post">
      <PostHeader source={article.source} sortTs={sortTs} />
      <div className="gn-post__body">
        <h2 className="gn-post__title">
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {articleDisplayTitle(article)}
          </a>
        </h2>
        <p className="gn-post__text">{articleDisplayText(article)}</p>
        {articleDisplayFacts(article).length > 0 ? (
          <ul className="gn-post__facts">
            {articleDisplayFacts(article).slice(0, 3).map((f, i) => (
              <li key={`fact-${i}`}>{f}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <PostMedia article={article} />
      <PostFooter article={article} />
    </article>
  );
}

export function FeedCard({ item }: FeedCardProps) {
  if (item.kind === "trending") return <TrendingCard item={item} />;
  return <SingleCard item={item} />;
}
