import type { EngineStatus } from "../types";
import { type ModelBootState } from "../summarize/summarizerClient";

type EnginePanelProps = {
  open: boolean;
  onToggle: () => void;
  status: EngineStatus;
  modelBoot: ModelBootState;
  onRefresh: () => void;
};

const PIPELINE_STEPS = [
  { key: "polling", label: "RSS" },
  { key: "extracting", label: "Extract" },
  { key: "summarizing", label: "Qwen" },
  { key: "indexing", label: "Index" },
  { key: "ready", label: "Search" },
] as const;

function fmtTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "rss":
      return "◉";
    case "extract":
      return "↓";
    case "summarize":
      return "◎";
    case "index":
      return "⌗";
    case "search":
      return "⌕";
    case "model":
      return "◈";
    case "connector":
      return "⎇";
    case "error":
      return "✗";
    default:
      return "·";
  }
}

export function EnginePanel({ open, onToggle, status, modelBoot, onRefresh }: EnginePanelProps) {
  const active = status.phase !== "idle" && status.phase !== "ready";
  const feedPct = status.feedsTotal ? Math.round((status.feedsOk / status.feedsTotal) * 100) : 0;
  const phaseIdx = PIPELINE_STEPS.findIndex((s) => s.key === status.phase);

  return (
    <>
      <button
        type="button"
        className={`gn-engine-btn${open ? " gn-engine-btn--open" : ""}${active ? " gn-engine-btn--active" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="gn-engine-panel"
      >
        <span className="gn-engine-btn__dot" aria-hidden="true" />
        ENGINE
        {active ? <span className="gn-engine-btn__pulse">live</span> : null}
      </button>

      {open ? (
        <aside id="gn-engine-panel" className="gn-engine-panel" aria-label="Intelligence engine control">
          <header className="gn-engine-panel__head">
            <h2>Intelligence Engine</h2>
            <button type="button" className="gn-engine-panel__close" onClick={onToggle} aria-label="Close panel">
              ×
            </button>
          </header>

          <div className="gn-engine-panel__toolbar">
            <button type="button" className="gn-engine-panel__refresh" onClick={onRefresh}>
              Refresh feeds
            </button>
            {active ? <span className="gn-engine-panel__live">● processing</span> : null}
          </div>

          <section className="gn-engine-panel__section">
            <h3>Pipeline</h3>
            <ol className="gn-pipeline">
              {PIPELINE_STEPS.map((step, i) => (
                <li
                  key={step.key}
                  className={`gn-pipeline__step${status.phase === step.key ? " gn-pipeline__step--active" : ""}${
                    phaseIdx > i ? " gn-pipeline__step--done" : ""
                  }`}
                >
                  {step.label}
                </li>
              ))}
            </ol>
            <p className="gn-engine-panel__msg">{status.message}</p>
          </section>

          <section className="gn-engine-panel__section">
            <h3>Counts</h3>
            <dl className="gn-stats-grid">
              <div>
                <dt>RSS headlines</dt>
                <dd>{status.rssHeadlines}</dd>
              </div>
              <div>
                <dt>Pending queue</dt>
                <dd>{status.pendingArticles}</dd>
              </div>
              <div>
                <dt>Indexed articles</dt>
                <dd>{status.articlesIndexed}</dd>
              </div>
              <div>
                <dt>Qwen summaries</dt>
                <dd>{status.summarizedByModel}</dd>
              </div>
              <div>
                <dt>Feeds OK</dt>
                <dd>
                  {status.feedsOk}/{status.feedsTotal}
                  {status.feedsFailed > 0 ? ` (${status.feedsFailed} failed)` : ""}
                </dd>
              </div>
              <div>
                <dt>Cross-source</dt>
                <dd>{status.multiSourceClusters}</dd>
              </div>
              <div>
                <dt>Story groups</dt>
                <dd>{status.clustersTotal}</dd>
              </div>
              <div>
                <dt>API connectors</dt>
                <dd>{status.connectorsIngested}</dd>
              </div>
              <div>
                <dt>Last connector</dt>
                <dd>{fmtTime(status.lastConnectorAt)}</dd>
              </div>
            </dl>
            <div className="gn-feed-bar" aria-hidden="true">
              <div className="gn-feed-bar__fill" style={{ width: `${feedPct}%` }} />
            </div>
            <p className="gn-engine-panel__hint">
              RSS + GitHub API + Hugging Face Hub. Max 48 RSS + 8 connector summaries per poll. Search scans all headlines.
            </p>
          </section>

          <section className="gn-engine-panel__section">
            <h3>Qwen model</h3>
            <p className={`gn-model-line gn-model-line--${modelBoot.phase}`}>
              <strong>{status.modelReady ? "READY" : modelBoot.phase.toUpperCase()}</strong>
              {modelBoot.device ? ` · ${modelBoot.device}` : ""}
              {modelBoot.phase === "downloading" ? ` · ${modelBoot.pct}%` : ""}
            </p>
            <p className="gn-engine-panel__sub">{modelBoot.message}</p>
          </section>

          {status.lastSummary ? (
            <section className="gn-engine-panel__section">
              <h3>Last summary {status.lastSummary.byModel ? "(Qwen)" : "(RSS fallback)"}</h3>
              <p className="gn-last-summary__title">{status.lastSummary.title}</p>
              <p className="gn-last-summary__meta">{status.lastSummary.source}</p>
              <p className="gn-last-summary__text">{status.lastSummary.summary}</p>
              {status.lastSummary.keyFacts.length > 0 ? (
                <ul className="gn-last-summary__facts">
                  {status.lastSummary.keyFacts.map((f, i) => (
                    <li key={`summary-fact-${i}`}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {status.lastSearch ? (
            <section className="gn-engine-panel__section">
              <h3>Last search</h3>
              <p className="gn-last-search__q">
                &quot;{status.lastSearch.query}&quot; → {status.lastSearch.resultCount} results (
                {status.lastSearch.indexedMatches} indexed + {status.lastSearch.headlineMatches} headlines +{" "}
                {status.lastSearch.githubMatches} GitHub + {status.lastSearch.hfMatches} HF)
              </p>
              <p className="gn-last-search__terms" dir="ltr">
                Terms: {status.lastSearch.expandedTerms.join(", ")}
              </p>
            </section>
          ) : null}

          <section className="gn-engine-panel__section gn-engine-panel__feeds">
            <h3>Feed status ({status.feedsTotal})</h3>
            <ul className="gn-feed-list">
              {status.feedStatuses.map((f) => (
                <li key={f.key} className={`gn-feed-list__item gn-feed-list__item--${f.state}`}>
                  <span className="gn-feed-list__icon">{f.state === "ok" ? "✓" : f.state === "fail" ? "✗" : "…"}</span>
                  <span className="gn-feed-list__label">{f.label}</span>
                  {f.items != null ? <span className="gn-feed-list__n">{f.items}</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="gn-engine-panel__section gn-engine-panel__log">
            <h3>Activity log</h3>
            <ul className="gn-activity-log">
              {status.activityLog.length === 0 ? (
                <li className="gn-activity-log__empty">No activity yet.</li>
              ) : (
                status.activityLog.map((e) => (
                  <li key={`${e.ts}-${e.message}`} className={`gn-activity-log__item gn-activity-log__item--${e.kind}`}>
                    <span className="gn-activity-log__time">{fmtTime(e.ts)}</span>
                    <span className="gn-activity-log__icon">{kindIcon(e.kind)}</span>
                    <span className="gn-activity-log__msg">{e.message}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      ) : null}
    </>
  );
}
