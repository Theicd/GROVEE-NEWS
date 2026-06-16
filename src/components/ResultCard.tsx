import type { SearchHit } from "../types";
import { cleanKeyFacts, pickDisplaySummary, pickDisplayTitle } from "../summarize/summaryQuality";
import { ArticleMedia } from "./ArticleMedia";

type ResultCardProps = {
  hit: SearchHit;
  rank?: number;
};

function githubBrowseUrl(repoUrl: string): string {
  return `${repoUrl.replace(/\/$/, "")}/tree/main`;
}

export function ResultCard({ hit, rank }: ResultCardProps) {
  const { article, cluster } = hit;
  const isGithub = hit.sourceKind === "github";
  const isHf = hit.sourceKind === "huggingface";
  const isHfSpace = isHf && article.sourceKey === "hf_space";
  const isHfModel = isHf && article.sourceKey !== "hf_space";
  const date = new Date(article.publishDate).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article className="gn-card">
      <ArticleMedia
        variant="card"
        articleId={article.id}
        url={article.url}
        title={article.title}
        image={article.image}
      />
      <div className="gn-card__body">
        <h2>{pickDisplayTitle(article.title, article.articleText, article.summary, article.displayTitle ?? "")}</h2>
        <p className="gn-card__meta">
          {rank != null ? <span className="gn-card__rank">#{rank}</span> : null}
          <span>{article.source}</span>
          <span>·</span>
          <time dateTime={article.publishDate}>{date}</time>
          <span>·</span>
          <span className="gn-card__relevance" title="Relevance score">
            match {hit.score}
          </span>
          <span>·</span>
          {isGithub ? (
            <span className="gn-card__headline-badge gn-card__live-badge">GitHub · live search</span>
          ) : isHfSpace ? (
            <span className="gn-card__headline-badge gn-card__live-badge">HF Space · live search</span>
          ) : isHfModel ? (
            <span className="gn-card__headline-badge gn-card__live-badge">HF Model · live search</span>
          ) : hit.sourceKind === "headline" ? (
            <span className="gn-card__headline-badge">RSS headline — not summarized yet</span>
          ) : (
            <span className={`gn-confidence gn-confidence--${article.confidence.toLowerCase()}`}>
              {article.confidence} confidence
            </span>
          )}
        </p>
        <p className="gn-card__summary">
          {pickDisplaySummary(article.summary, article.articleText, article.title, "", article.displaySummary ?? "")}
        </p>
        {cleanKeyFacts(article.keyFacts).length > 0 ? (
          <ul className="gn-card__facts">
            {cleanKeyFacts(article.keyFacts).slice(0, 6).map((f, i) => (
              <li key={`${article.id}-fact-${i}`}>{f}</li>
            ))}
          </ul>
        ) : null}
        <div className="gn-card__actions">
          {isGithub ? (
            <>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                Open repository
              </a>
              <a href={githubBrowseUrl(article.url)} target="_blank" rel="noopener noreferrer">
                Browse files
              </a>
            </>
          ) : isHfSpace ? (
            <>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                Open Space
              </a>
              <a href={`${article.url}/blob/main/README.md`} target="_blank" rel="noopener noreferrer">
                View README
              </a>
            </>
          ) : isHfModel ? (
            <>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                Open model page
              </a>
              <a href={`${article.url}/tree/main`} target="_blank" rel="noopener noreferrer">
                Browse files
              </a>
            </>
          ) : (
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              Open original article
            </a>
          )}
          {cluster && cluster.sourceKeys.length > 1 ? (
            <div className="gn-card__cluster">
              <strong>Cross-source story</strong> — {cluster.sourceKeys.length} outlets:{" "}
              {cluster.sourceKeys.join(", ")} · {cluster.confidence} confidence
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
