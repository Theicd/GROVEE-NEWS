import { useEffect, useRef, useState, type FormEvent } from "react";
import { getEngineStatus, pollAllFeeds, searchNews, startEngine, subscribeEngineStatus } from "./engine/pipeline";
import type { SearchUpdate } from "./engine/pipeline";
import type { EngineStatus, SearchHit } from "./types";
import { NewsFeed } from "./components/NewsFeed";
import { ResultCard } from "./components/ResultCard";
import { EnginePanel } from "./components/EnginePanel";
import { ModelBootScreen } from "./components/ModelBootScreen";
import { bootSummarizer, getModelBootState, subscribeModelBoot, type ModelBootState } from "./summarize/summarizerClient";
import "./components/app.css";

type AppPhase = "model_boot" | "intelligence";

export function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>(() =>
    localStorage.getItem("gn-engaged") === "1" ? "intelligence" : "model_boot",
  );
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<EngineStatus>(getEngineStatus());
  const [modelBoot, setModelBoot] = useState<ModelBootState>(getModelBootState());
  const [engineOpen, setEngineOpen] = useState(false);
  const searchGenRef = useRef(0);
  const [searchPhase, setSearchPhase] = useState<SearchUpdate["phase"] | null>(null);

  useEffect(() => {
    if (appPhase !== "intelligence") return;
    const unsub = subscribeEngineStatus(setStatus);
    const unsubModel = subscribeModelBoot(setModelBoot);
    if (getModelBootState().phase === "idle") {
      bootSummarizer();
    }
    void startEngine();
    return () => {
      unsub();
      unsubModel();
    };
  }, [appPhase]);

  const onEngage = () => {
    localStorage.setItem("gn-engaged", "1");
    setAppPhase("intelligence");
  };

  const onSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    const gen = ++searchGenRef.current;
    setSubmitted(q);
    setHits([]);
    setSearchPhase("indexed");
    setSearching(true);
    try {
      await searchNews(q, (update) => {
        if (gen !== searchGenRef.current) return;
        setHits(update.hits);
        setSearchPhase(update.phase);
      });
    } finally {
      if (gen === searchGenRef.current) {
        setSearching(false);
        setSearchPhase(null);
      }
    }
  };

  if (appPhase === "model_boot") {
    return <ModelBootScreen onReady={onEngage} />;
  }

  const showHome = !submitted;

  return (
    <div className="gn-app">
      <header className="gn-header">
        <button
          type="button"
          className="gn-logo"
          onClick={() => {
            setSubmitted("");
            setHits([]);
            setQuery("");
          }}
        >
          GROVEE NEWS
        </button>
        <form className="gn-search gn-search--header" onSubmit={onSearch}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search news — add github or huggingface for repos/models"
            aria-label="Search news intelligence"
          />
          <button type="submit" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        <EnginePanel
          open={engineOpen}
          onToggle={() => setEngineOpen((v) => !v)}
          status={status}
          modelBoot={modelBoot}
          onRefresh={() => void pollAllFeeds()}
        />
      </header>

      <main className="gn-main">
        {showHome ? (
          <NewsFeed
            refreshKey={status.articlesIndexed + status.summarizedByModel + status.multiSourceClusters}
            articlesIndexed={status.articlesIndexed}
          />
        ) : (
          <section className="gn-results">
            <p className="gn-results-meta">
              {searching
                ? searchPhase === "indexed"
                  ? `Found ${hits.length} indexed matches — scanning headlines…`
                  : searchPhase === "headlines"
                    ? `${hits.length} results so far — checking GitHub & Hugging Face…`
                    : searchPhase === "live"
                      ? `${hits.length} results — refining with AI terms…`
                      : searchPhase === "refined"
                        ? `${hits.length} results — finalizing…`
                        : "Searching news, GitHub & Hugging Face…"
                : status.lastSearch && status.lastSearch.query === submitted
                  ? status.lastSearch.liveGithubSkipped && status.lastSearch.liveHfSkipped
                    ? `${hits.length} results — news only (GitHub/HF skipped for this query)`
                    : `${hits.length} results — ${status.lastSearch.indexedMatches} indexed + ${status.lastSearch.headlineMatches} headlines + ${status.lastSearch.githubMatches} GitHub + ${status.lastSearch.hfMatches} HF${status.lastSearch.githubRateLimited ? " · GitHub rate-limited" : ""}`
                  : `${hits.length} results for "${submitted}"`}
            </p>
            {hits.map((hit, i) => (
              <ResultCard key={hit.article.id} hit={hit} rank={i + 1} />
            ))}
            {!searching && hits.length === 0 ? (
              <p className="gn-empty">
                No matches. News: trump, nasa · GitHub: github react ui · HF: huggingface llama model
              </p>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
